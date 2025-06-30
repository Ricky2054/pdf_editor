# PDF Editor Pro

A professional PDF editing application built with Next.js, Supabase, and React PDF. Features include PDF viewing, annotation tools, user authentication, and cloud storage.

## 🚀 Features

- **PDF Viewing & Editing**: Upload, view, and edit PDF documents
- **Annotation Tools**: Pen, highlighter, shapes, text, and eraser tools
- **User Authentication**: Secure login and registration with Supabase
- **Cloud Storage**: Documents stored securely in Supabase Storage
- **Responsive Design**: Modern UI that works on all devices
- **Real-time Collaboration**: Share and collaborate on documents
- **Document Management**: Organize and manage your PDF files

## 📋 Prerequisites

Before running this application, make sure you have:

- Node.js (18.x or later)
- npm or pnpm package manager
- A Supabase account (free tier available)

## 🛠️ Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd pdf_editor
```

### 2. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 3. Set Up Supabase

1. Go to [Supabase](https://supabase.com) and create a new project
2. Wait for the project to be fully set up
3. Go to Settings > API in your Supabase dashboard
4. Copy your Project URL and Anon Key

### 4. Environment Variables

Create a `.env.local` file in the root directory and add your Supabase credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Example:
# NEXT_PUBLIC_SUPABASE_URL=https://xyzcompany.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5. Set Up Database Tables

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents from `scripts/create-tables.sql`
4. Run the SQL script to create all necessary tables and security policies

### 6. Set Up Storage

1. In your Supabase dashboard, go to Storage
2. Create a new bucket called `documents`
3. Set the bucket to public or configure appropriate access policies

### 7. Run the Application

```bash
npm run dev
# or
pnpm dev
```

The application will be available at `http://localhost:3000`

## 📱 Usage

### Getting Started

1. **Sign Up**: Create a new account or log in with existing credentials
2. **Upload PDF**: Use the dashboard to upload your PDF files
3. **Edit Documents**: Open the editor to annotate and edit your PDFs
4. **Save & Share**: Save your work and share documents with others

### Features Guide

#### Dashboard
- View all your uploaded documents
- Upload new PDF files
- Search and filter documents
- Quick access to editor

#### Editor
- **Tools**: Pen, highlighter, shapes, text, and eraser
- **Navigation**: Page controls, zoom, and rotation
- **Customization**: Adjust tool colors and sizes
- **Export**: Download edited PDFs

#### Authentication
- Secure user registration and login
- Password reset functionality
- Profile management

## 🏗️ Project Structure

```
pdf_editor/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Dashboard page
│   ├── editor/            # PDF editor page
│   └── layout.tsx         # Root layout
├── components/            # Reusable UI components
│   └── ui/               # shadcn/ui components
├── lib/                   # Utility functions
│   ├── supabase.ts       # Supabase configuration
│   └── utils.ts          # Helper utilities
├── scripts/              # Database scripts
└── public/               # Static assets
```

## 🔧 Technologies Used

- **Frontend**: Next.js 14, React 18, TypeScript
- **UI Components**: shadcn/ui, Tailwind CSS
- **PDF Processing**: react-pdf, PDF.js
- **Authentication**: Supabase Auth
- **Database**: PostgreSQL (Supabase)
- **Storage**: Supabase Storage
- **Deployment**: Vercel ready

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy with automatic builds

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## 🔒 Security Features

- Row Level Security (RLS) enabled
- JWT-based authentication
- Encrypted file storage
- CORS protection
- Environment variable protection

## 📝 Database Schema

The application uses the following main tables:
- `users`: User profiles and authentication
- `documents`: PDF document metadata
- `annotations`: Drawing and annotation data
- `document_shares`: Collaboration and sharing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🐛 Troubleshooting

### Common Issues

1. **PDF.js Worker Error**: The app automatically loads the PDF.js worker from CDN
2. **Supabase Connection**: Verify your environment variables are correct
3. **File Upload Issues**: Check your Supabase storage bucket permissions
4. **Authentication Problems**: Ensure RLS policies are properly set up

### Getting Help

- Check the browser console for error messages
- Verify all environment variables are set correctly
- Ensure Supabase tables and storage are properly configured
- Review the Supabase logs for backend issues

## 🔄 Updates & Maintenance

- Keep dependencies updated regularly
- Monitor Supabase usage and quotas
- Back up your database periodically
- Review and update security policies as needed 