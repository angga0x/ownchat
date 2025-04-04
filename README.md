# TeleChat - Real-Time Messaging Application

A modern real-time chat application providing seamless communication with rich, interactive messaging features and advanced collaboration tools.

![TeleChat Screenshot](screenshot.png)

## Features

- Real-time messaging with Socket.IO
- User authentication with JWT
- Message management (delete for me, delete for all)
- Image upload and sharing
- Facebook Messenger-inspired UI with dark/light mode support
- Typing indicators and read receipts
- Advanced emoji picker with shortcut functionality (type `:` to trigger)
- Responsive design for mobile and desktop
- Chat archiving and pinning
- MongoDB database for data persistence

## Tech Stack

- **Frontend**: React, TypeScript, TailwindCSS, Socket.IO client
- **Backend**: Express.js, Socket.IO, MongoDB
- **Authentication**: JWT (JSON Web Tokens)
- **UI Components**: shadcn/ui, Lucide icons
- **State Management**: React Query, Context API

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas account)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/telechat.git
   cd telechat
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_secret_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Visit `http://localhost:5000` in your browser to use the application.

## Deployment

The application can be deployed to any hosting service that supports Node.js. For example:

- Vercel
- Heroku
- Railway
- Render
- DigitalOcean

## Project Structure

```
/
├── client/               # Frontend React application
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utility functions
│   │   └── pages/        # Page components
│   └── index.html        # HTML entry point
├── server/               # Backend Express application
│   ├── models/           # Database models
│   ├── routes.ts         # API routes
│   ├── auth.ts           # Authentication logic
│   ├── db.ts             # Database connection
│   ├── storage.ts        # Storage implementation
│   └── index.ts          # Main server file
├── shared/               # Shared code between client and server
│   └── schema.ts         # TypeScript interfaces and schemas
└── package.json          # Project dependencies and scripts
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Socket.IO](https://socket.io/) for real-time communication
- [shadcn/ui](https://ui.shadcn.com/) for beautiful UI components
- [Lucide](https://lucide.dev/) for icon set
- [TailwindCSS](https://tailwindcss.com/) for styling