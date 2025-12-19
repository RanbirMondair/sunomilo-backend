const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

// Create payment intent
router.post('/create-intent', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { plan_id } = req.body;

    // Get plan price
    const plans = {
      '1month': { price: 2999, duration: '1 Monat' },
      '6months': { price: 11994, duration: '6 Monate' },
      '12months': { price: 17988, duration: '12 Monate' }
    };

    const plan = plans[plan_id];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    // Get user email
    const userResult = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [req.userId]
    );

    const userEmail = userResult.rows[0].email;

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: plan.price,
      currency: 'eur',
      metadata: {
        userId: req.userId,
        planId: plan_id,
        userEmail: userEmail
      },
      description: `SunoMilo Premium - ${plan.duration}`
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      amount: plan.price / 100
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Confirm payment
router.post('/confirm', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { paymentIntentId, plan_id } = req.body;

    // Get payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not successful' });
    }

    // Create subscription
    const plans = {
      '1month': { duration_months: 1, price: 29.99 },
      '6months': { duration_months: 6, price: 119.94 },
      '12months': { duration_months: 12, price: 179.88 }
    };

    const plan = plans[plan_id];
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + plan.duration_months);

    // Create subscription record
    const subResult = await pool.query(
      `INSERT INTO subscriptions (user_id, plan_type, duration_months, price, stripe_subscription_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.userId, plan_id, plan.duration_months, plan.price, paymentIntentId, expiryDate]
    );

    // Create payment record
    await pool.query(
      `INSERT INTO payments (user_id, subscription_id, amount, stripe_payment_id, status, payment_method)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.userId, subResult.rows[0].id, plan.price, paymentIntentId, 'completed', 'card']
    );

    // Update user premium status
    await pool.query(
      'UPDATE users SET is_premium = true, premium_until = $1 WHERE id = $2',
      [expiryDate, req.userId]
    );

    res.json({
      success: true,
      subscription: subResult.rows[0]
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// Get payment history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );

    res.json({
      success: true,
      payments: result.rows
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

module.exports = router;
