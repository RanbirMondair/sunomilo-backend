# SunoMilo Backend

Complete Node.js + Express backend for the SunoMilo dating app with PostgreSQL database, Stripe payments, and Socket.io real-time chat.

## Features

- ✅ User authentication (JWT)
- ✅ Profile management with image uploads (Cloudinary)
- ✅ Swiping interface (Likes/Dislikes)
- ✅ Matching algorithm
- ✅ Real-time chat (Socket.io)
- ✅ Stripe payment integration
- ✅ Subscription management
- ✅ User blocking and reporting

## Tech Stack

- **Framework:** Node.js + Express
- **Database:** PostgreSQL
- **Authentication:** JWT
- **File Storage:** Cloudinary
- **Payments:** Stripe
- **Real-time:** Socket.io
- **Image Processing:** Multer

## Setup

### 1. Environment Variables

Create `.env` file:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/sunomilo

# JWT
JWT_SECRET=your_jwt_secret_key_here

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Stripe
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 2. Database Setup

```bash
# Connect to PostgreSQL
psql -U postgres

# Run database initialization
\i db.sql
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start Server

```bash
# Development
npm run dev

# Production
npm start
```

Server will run on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify token

### Users
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update profile
- `GET /api/users/:userId` - Get user by ID
- `GET /api/users/discover/feed` - Get discover feed

### Profiles
- `GET /api/profiles/me` - Get extended profile
- `PUT /api/profiles/me` - Update extended profile
- `POST /api/profiles/images/upload` - Upload profile images
- `GET /api/profiles/images` - Get profile images
- `DELETE /api/profiles/images/:imageId` - Delete image

### Likes
- `POST /api/likes/:userId` - Like/dislike user
- `GET /api/likes/received` - Get likes received
- `GET /api/likes/sent` - Get likes sent

### Matches
- `GET /api/matches` - Get all matches
- `GET /api/matches/:matchId` - Get match details
- `DELETE /api/matches/:matchId` - Unmatch

### Messages
- `POST /api/messages/:matchId` - Send message
- `GET /api/messages/:matchId` - Get messages
- `GET /api/messages/unread/count` - Get unread count

### Subscriptions
- `GET /api/subscriptions/plans` - Get subscription plans
- `GET /api/subscriptions/current` - Get current subscription
- `GET /api/subscriptions/history` - Get subscription history
- `POST /api/subscriptions/create` - Create subscription
- `POST /api/subscriptions/:subscriptionId/cancel` - Cancel subscription

### Payments
- `POST /api/payments/create-intent` - Create payment intent
- `POST /api/payments/confirm` - Confirm payment
- `GET /api/payments/history` - Get payment history

## Database Schema

### Users Table
- id (Primary Key)
- email (Unique)
- phone (Unique)
- password_hash
- name
- age
- gender
- country
- bio
- profile_image_url
- location
- interests (Array)
- looking_for
- is_verified
- is_premium
- premium_until
- last_active
- created_at
- updated_at

### Profiles Table
- id (Primary Key)
- user_id (Foreign Key)
- height
- religion
- caste
- education
- occupation
- income_range
- marital_status
- children
- drinking
- smoking
- languages (Array)
- family_values
- looking_for_description

### Likes Table
- id (Primary Key)
- user_id (Foreign Key)
- liked_user_id (Foreign Key)
- is_like (Boolean)
- created_at

### Matches Table
- id (Primary Key)
- user1_id (Foreign Key)
- user2_id (Foreign Key)
- matched_at
- is_active

### Messages Table
- id (Primary Key)
- match_id (Foreign Key)
- sender_id (Foreign Key)
- content
- is_read
- created_at

### Subscriptions Table
- id (Primary Key)
- user_id (Foreign Key)
- plan_type
- duration_months
- price
- stripe_subscription_id
- status
- started_at
- expires_at

### Payments Table
- id (Primary Key)
- user_id (Foreign Key)
- subscription_id (Foreign Key)
- amount
- stripe_payment_id
- status
- payment_method
- created_at

## Socket.io Events

### Client to Server
- `join_match` - Join match room
- `send_message` - Send message
- `typing` - Typing indicator

### Server to Client
- `receive_message` - Receive message
- `user_typing` - User typing

## Error Handling

All errors return JSON with error message:

```json
{
  "error": "Error message here"
}
```

## Security

- Passwords hashed with bcryptjs
- JWT tokens for authentication
- CORS enabled for frontend
- Input validation on all endpoints
- SQL injection prevention with parameterized queries

## Deployment

### Railway

1. Push code to GitHub
2. Connect GitHub repository to Railway
3. Set environment variables in Railway dashboard
4. Deploy

### Heroku

```bash
heroku create sunomilo-backend
heroku addons:create heroku-postgresql:hobby-dev
git push heroku main
```

## Development

### Install Nodemon

```bash
npm install --save-dev nodemon
```

### Run with auto-reload

```bash
npm run dev
```

## Testing

Use Postman or similar tool to test endpoints.

## Support

For issues or questions, contact the development team.
