"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, FileText, Edit, Users, Shield } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      setUser(JSON.parse(userData))
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600 mr-2" />
              <h1 className="text-2xl font-bold text-gray-900">PDF Editor Pro</h1>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <span className="text-gray-700">Welcome, {user.name}</span>
                  <Link href="/dashboard">
                    <Button>Dashboard</Button>
                  </Link>
                  <Button
                    variant="outline"
                    onClick={() => {
                      localStorage.removeItem("user")
                      setUser(null)
                    }}
                  >
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/auth/login">
                    <Button variant="outline">Login</Button>
                  </Link>
                  <Link href="/auth/register">
                    <Button>Sign Up</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">Professional PDF Editing Made Simple</h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Upload, view, edit, annotate, and collaborate on PDF documents with our comprehensive online editor. No
            software installation required.
          </p>
          <div className="flex justify-center space-x-4">
            <Link href={user ? "/dashboard" : "/auth/register"}>
              <Button size="lg" className="px-8 py-3">
                Get Started Free
              </Button>
            </Link>
            <Link href="/editor">
              <Button size="lg" variant="outline" className="px-8 py-3 bg-transparent">
                Try Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">Powerful Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card>
              <CardHeader>
                <Upload className="h-10 w-10 text-blue-600 mb-2" />
                <CardTitle>Easy Upload</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Drag and drop PDF files or browse to upload. Support for multiple file formats with automatic
                  conversion.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Edit className="h-10 w-10 text-green-600 mb-2" />
                <CardTitle>Advanced Editing</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Edit text, add annotations, draw shapes, highlight content, and insert signatures with professional
                  tools.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-purple-600 mb-2" />
                <CardTitle>Collaboration</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Share documents, collaborate in real-time, and manage permissions for team-based editing workflows.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-10 w-10 text-red-600 mb-2" />
                <CardTitle>Secure & Private</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Enterprise-grade security with encrypted storage, secure authentication, and privacy-first design.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-3xl font-bold text-white mb-4">Ready to Transform Your PDF Workflow?</h3>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of professionals who trust PDF Editor Pro for their document needs.
          </p>
          <Link href={user ? "/dashboard" : "/auth/register"}>
            <Button size="lg" variant="secondary" className="px-8 py-3">
              Start Editing Now
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <FileText className="h-6 w-6 mr-2" />
                <span className="text-lg font-bold">PDF Editor Pro</span>
              </div>
              <p className="text-gray-400">Professional PDF editing tools for modern workflows.</p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Features</h4>
              <ul className="space-y-2 text-gray-400">
                <li>PDF Viewing</li>
                <li>Text Editing</li>
                <li>Annotations</li>
                <li>Digital Signatures</li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Documentation</li>
                <li>API Reference</li>
                <li>Contact Support</li>
                <li>Community</li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li>About Us</li>
                <li>Privacy Policy</li>
                <li>Terms of Service</li>
                <li>Security</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 PDF Editor Pro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
