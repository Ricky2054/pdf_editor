"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FileText, Upload, Search, Filter, MoreVertical, Edit, Download, Share, Plus, Grid, List, Trash } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { Document } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const router = useRouter()
  const { toast } = useToast()
  const uploadInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    checkAuth()
  }, [router])

  const checkAuth = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push("/auth/login")
        return
      }

      // Try to get user profile, if it doesn't exist, create it
      let { data: profile, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single()

      if (profileError && profileError.code === 'PGRST116') {
        // User profile doesn't exist, create it
        const { data: newProfile, error: createError } = await supabase
          .from("users")
          .insert([
            {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            },
          ])
          .select()
          .single()

        if (createError) {
          console.error("Error creating user profile:", createError)
          setError("Failed to create user profile")
        } else {
          profile = newProfile
        }
      } else if (profileError) {
        console.error("Error loading user profile:", profileError)
        setError("Failed to load user profile")
      }

      if (profile) {
        setUser(profile)
        localStorage.setItem("user", JSON.stringify(profile))
        await loadDocuments(session.user.id)
      } else {
        // Fallback: use session data if profile creation failed
        const fallbackUser = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
        }
        setUser(fallbackUser)
        localStorage.setItem("user", JSON.stringify(fallbackUser))
        await loadDocuments(session.user.id)
      }

    } catch (error) {
      console.error("Auth check failed:", error)
      setError("Authentication failed")
      // Don't redirect, show error instead
    } finally {
      setLoading(false)
    }
  }

  const loadDocuments = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading documents:", error)

        // Gracefully handle the two most common startup issues:
        // 1) Table has not been created yet (error.code === '42P01').
        // 2) Row-level-security / permission denied (error.code === '42501').
        // In both scenarios, we initialise with an empty list so the user can
        // still upload a first document – the upload flow will create the
        // table row and from the next refresh the dashboard will populate.

        const harmlessCodes = ['PGRST116', '42P01', '42501']

        if (!harmlessCodes.includes(error.code)) {
          toast({
            title: "Warning",
            description: "Could not load documents. You can still upload new files.",
            variant: "destructive",
          })
        }

        // Fallback to empty list so UI remains functional.
        setDocuments([])
      } else {
        setDocuments(data || [])
      }
    } catch (error) {
      console.error("Failed to load documents:", error)
      // Don't show error - just set empty documents
      setDocuments([])
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid file type",
        description: "Please select a PDF file",
        variant: "destructive",
      })
      return
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please log in to upload files",
          variant: "destructive",
        })
        return
      }

      // Upload file to Supabase Storage
      const fileExt = file.name.split(".").pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `${session.user.id}/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage.from("documents").upload(filePath, file)

      if (uploadError) {
        console.error("Upload error:", uploadError)
        toast({
          title: "Upload failed",
          description: "Failed to upload file. Please try again.",
          variant: "destructive",
        })
        return
      }

      // Create document record in database
      const { error: docError } = await supabase
        .from("documents")
        .insert(
          [
            {
              user_id: session.user.id,
              name: file.name,
              file_path: uploadData.path,
              file_size: file.size,
              mime_type: file.type,
              status: "ready",
            },
          ],
          {
            returning: "minimal", // avoids SELECT permission requirement
          }
        )

      if (docError) {
        console.error("Document creation error:", docError)
        toast({
          title: `DB error ${docError.code}`,
          description: docError.message,
          variant: "destructive",
        })
      } else {
        // Re-fetch docs to include the newly uploaded one
        await loadDocuments(session.user.id)
        toast({
          title: "Success",
          description: "PDF uploaded successfully!",
        })
      }
    } catch (error) {
      console.error("Upload failed:", error)
      toast({
        title: "Upload failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem("user")
    router.push("/")
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) return "Today"
    if (diffDays === 2) return "Yesterday"
    if (diffDays <= 7) return `${diffDays - 1} days ago`
    return date.toLocaleDateString()
  }

  const filteredDocuments = documents.filter((doc) => doc.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const handleDeleteDocument = async (doc: Document) => {
    const confirmed = window.confirm(`Delete ${doc.name}? This cannot be undone.`)
    if (!confirmed) return

    try {
      // Attempt to remove the file from Storage – if it was already removed
      // (404) we still proceed with deleting the DB row.
      const { error: storageError } = await supabase.storage.from('documents').remove([doc.file_path])
      if (storageError && storageError.message && !storageError.message.includes('Object not found')) {
        console.warn('Storage delete error (blocking):', storageError)
        toast({ title: 'Delete failed', description: storageError.message, variant: 'destructive' })
        return
      }

      // Remove record from DB
      const { error: dbError } = await supabase.from('documents').delete().eq('id', doc.id)
      if (dbError) {
        console.error('DB delete error:', dbError)
        toast({ title: 'Delete failed', description: 'Could not remove database record.', variant: 'destructive' })
        return
      }

      // Update local state
      setDocuments(prev => prev.filter(d => d.id !== doc.id))
      toast({ title: 'Document deleted' })
    } catch (err) {
      console.error('Delete failed:', err)
      toast({ title: 'Delete failed', description: 'Unexpected error.', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-x-4">
            <Link href="/auth/login">
              <Button>Login</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Go Home</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <FileText className="h-8 w-8 text-blue-600 mr-2" />
                <h1 className="text-2xl font-bold text-gray-900">PDF Editor Pro</h1>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.name || 'User'}</span>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">My Documents</h2>
          <p className="text-gray-600">Manage and edit your PDF documents</p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <input
                ref={uploadInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button className="cursor-pointer" onClick={() => uploadInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Upload PDF
              </Button>
            </div>
            <Link href="/editor">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                New Document
              </Button>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4" />
            </Button>
            <div className="flex border rounded-md">
              <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("grid")}>
                <Grid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("list")}>
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Documents Grid/List */}
        {filteredDocuments.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No documents yet</h3>
              <p className="text-gray-600 mb-4">Upload your first PDF to get started</p>
              <Button className="cursor-pointer" onClick={() => uploadInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Upload PDF
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div
            className={
              viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-4"
            }
          >
            {filteredDocuments.map((doc) => (
              <Card
                key={doc.id}
                className={`hover:shadow-md transition-shadow ${viewMode === "list" ? "flex items-center p-4" : ""}`}
              >
                {viewMode === "grid" ? (
                  <>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <FileText className="h-8 w-8 text-red-500" />
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <h3 className="font-semibold text-gray-900 mb-1 truncate">{doc.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{formatFileSize(doc.file_size)}</p>
                      <p className="text-xs text-gray-500 mb-3">Modified {formatDate(doc.updated_at)}</p>
                      <Badge
                        variant={
                          doc.status === "ready" ? "default" : doc.status === "processing" ? "secondary" : "destructive"
                        }
                      >
                        {doc.status}
                      </Badge>
                      <div className="flex space-x-2 mt-4">
                        <Link href={`/editor?doc=${doc.id}`}>
                          <Button size="sm" className="flex-1">
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        </Link>
                        <Button variant="outline" size="sm">
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteDocument(doc)}>
                          <Trash className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-4">
                      <FileText className="h-8 w-8 text-red-500" />
                      <div>
                        <h3 className="font-semibold text-gray-900">{doc.name}</h3>
                        <p className="text-sm text-gray-600">
                          {formatFileSize(doc.file_size)} • Modified {formatDate(doc.updated_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={
                          doc.status === "ready" ? "default" : doc.status === "processing" ? "secondary" : "destructive"
                        }
                      >
                        {doc.status}
                      </Badge>
                      <Link href={`/editor?doc=${doc.id}`}>
                        <Button size="sm">
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      </Link>
                      <Button variant="outline" size="sm">
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeleteDocument(doc)}>
                        <Trash className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Share className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
