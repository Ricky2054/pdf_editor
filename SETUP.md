# Quick Setup Guide

## 🚀 Start Using the PDF Editor

The application has been configured and dependencies are installed. Follow these steps to get it running:

### 1. Set Up Supabase (Required)

1. **Create Supabase Account**: Go to [supabase.com](https://supabase.com) and create a free account
2. **Create New Project**: Click "New Project" and wait for setup to complete
3. **Get API Keys**: 
   - Go to Settings > API
   - Copy your Project URL and Anon Key

### 2. Configure Environment Variables

1. **Copy the example file**:
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local`** with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://pdjujmynbsvsnqhjxyrz.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkanVqbXluYnN2c25xaGp4eXJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwOTgzNzksImV4cCI6MjA2NjY3NDM3OX0.K3gTEQ-1fvWl8IVXowXqxLbTia6ynavaWV8KPQkZY7o
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkanVqbXluYnN2c25xaGp4eXJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTA5ODM3OSwiZXhwIjoyMDY2Njc0Mzc5fQ.yc5EC4Q88FcX3CVqCu_bzkg8jmFgD_xiuLAxOnDCqkE
   ```

### 3. Set Up Database

1. **Go to SQL Editor** in your Supabase dashboard
2. **Copy and paste** the entire contents of `scripts/create-tables.sql`
3. **Run the SQL** to create all tables and security policies

### 4. Set Up Storage

1. **Go to Storage** in your Supabase dashboard
2. **Create a new bucket** called `documents`
3. **Make it public** or set appropriate permissions

### 5. Start the Application

The dev server should already be running. If not:

```bash
npm run dev
```

Visit: `http://localhost:3000`

## ✅ What's Been Fixed

- ✅ **Dependencies**: All packages installed and conflicts resolved
- ✅ **Theme Provider**: Added for proper UI component styling
- ✅ **PDF.js Configuration**: Properly configured for PDF viewing
- ✅ **Authentication**: Supabase auth integrated throughout
- ✅ **Error Handling**: Comprehensive error handling and user feedback
- ✅ **Toast Notifications**: Added for user feedback
- ✅ **Responsive Design**: Mobile-friendly layouts
- ✅ **Security**: Row Level Security (RLS) policies configured
- ✅ **API Routes**: Cleaned up conflicting authentication routes

## 🎯 Features Ready to Use

1. **Landing Page**: Professional landing page with feature showcase
2. **Authentication**: Login/Register with Supabase
3. **Dashboard**: Document management and upload
4. **PDF Editor**: Full-featured PDF viewer and annotation tools
5. **File Storage**: Secure cloud storage with Supabase
6. **Responsive UI**: Works on desktop and mobile

## 🔧 Quick Test

1. Open `http://localhost:3000`
2. Click "Sign Up" to create an account
3. Upload a PDF from the dashboard
4. Open the editor to test annotation tools

## 🐛 Common Issues

- **Supabase Connection**: Make sure your `.env.local` file has correct credentials
- **Table Errors**: Ensure you've run the SQL script in Supabase
- **File Upload**: Check that your storage bucket exists and has proper permissions

## 📞 Need Help?

Check the main README.md for detailed troubleshooting and setup instructions. 