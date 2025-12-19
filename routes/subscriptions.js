const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Get subscription plans
router.get('/plans', (req, res) => {
  const plans = [
    {
      id: '1month',
      duration: '1 Monat',
      duration_months: 1,
      price: 29.99,
      monthly_price: 29.99,
      savings: null,
      popular: false,
      cancellation_terms: 'Jederzeit kündbar'
    },
    {
      id: '6months',
      duration: '6 Monate',
      duration_months: 6,
      price: 119.94,
      monthly_price: 19.99,
      savings: 60.00,
      popular: true,
      cancellation_terms: 'Keine Rückerstattung, Zugang für 6 Monate'
    },
    {
      id: '12months',
      duration: '12 Monate',
      duration_months: 12,
      price: 179.88,
      monthly_price: 14.99,
      savings: 179.94,
      popular: false,
      cancellation_terms: 'Keine Rückerstattung, Zugang für 12 Monate'
    }
  ];

  res.json({
    success: true,
    plans
  });
});

// Get current subscription
router.get('/current', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [req.userId, 'active']
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        subscription: null
      });
    }

    res.json({
      success: true,
      subscription: result.rows[0]
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Get subscription history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );

    res.json({
      success: true,
      subscriptions: result.rows
    });
  } catch (error) {
    console.error('Get subscription history error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription history' });
  }
});

// Create subscription (after payment)
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { plan_id, stripe_subscription_id } = req.body;

    // Get plan details
    const plans = {
      '1month': { duration_months: 1, price: 29.99 },
      '6months': { duration_months: 6, price: 119.94 },
      '12months': { duration_months: 12, price: 179.88 }
    };

    const plan = plans[plan_id];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    // Calculate expiry date
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + plan.duration_months);

    // Create subscription
    const result = await pool.query(
      `INSERT INTO subscriptions (user_id, plan_type, duration_months, price, stripe_subscription_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.userId, plan_id, plan.duration_months, plan.price, stripe_subscription_id, expiryDate]
    );

    // Update user premium status
    await pool.query(
      'UPDATE users SET is_premium = true, premium_until = $1 WHERE id = $2',
      [expiryDate, req.userId]
    );

    res.json({
      success: true,
      subscription: result.rows[0]
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Cancel subscription
router.post('/:subscriptionId/cancel', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { subscriptionId } = req.params;

    // Verify ownership
    const subResult = await pool.query(
      'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2',
      [subscriptionId, req.userId]
    );

    if (subResult.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Update subscription status
    await pool.query(
      'UPDATE subscriptions SET status = $1 WHERE id = $2',
      ['cancelled', subscriptionId]
    );

    // Update user premium status
    await pool.query(
      'UPDATE users SET is_premium = false WHERE id = $1',
      [req.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

module.exports = router;
