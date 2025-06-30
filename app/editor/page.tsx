"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  FileText,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Save,
  Pen,
  Square,
  Circle,
  Type,
  Highlighter,
  Eraser,
  Undo,
  Redo,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { supabase } from "@/lib/supabase"
import { useSearchParams } from "next/navigation"
import type { Annotation } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { PDFDocument, rgb } from "pdf-lib"
import { maskOriginalText } from "@/lib/pdf-editor"

// Dynamically import react-pdf components to avoid SSR issues
const Document = dynamic(
  () => import("react-pdf").then((mod) => mod.Document),
  { ssr: false }
)

const Page = dynamic(
  () => import("react-pdf").then((mod) => mod.Page),
  { ssr: false }
)

// Set up PDF.js worker for stable version 2.16.105
if (typeof window !== 'undefined') {
  import("react-pdf").then((mod) => {
    try {
      // Use local worker file for stable version 2.16.105
      mod.pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
      console.log('PDF.js worker configured with local worker file (v2.16.105)')
    } catch (error) {
      console.error('Failed to configure PDF.js worker:', error)
      try {
        // Fallback: use CDN worker for the correct version
        mod.pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js'
        console.log('Using fallback CDN worker for v2.16.105')
      } catch (fallbackError) {
        console.error('All worker configurations failed:', fallbackError)
      }
    }
  }).catch((error) => {
    console.warn('Failed to load PDF.js:', error)
  })
}

interface DrawingTool {
  type: "pen" | "highlighter" | "rectangle" | "circle" | "text" | "eraser"
  color: string
  size: number
  fill: boolean
  fillColor: string
}

interface TextEdit {
  id: string
  pageNum: number
  x: number
  y: number
  width: number
  height: number
  originalText: string
  newText: string
  fontSize: number
  fontColor: string
}

interface TextReplacement {
  id: string
  pageNum: number
  x: number
  y: number
  width: number
  height: number
  originalText: string
  newText: string
  fontSize: number
  fontColor: string
  backgroundColor: string
  isDeleted?: boolean
}

interface TextDeletion {
  id: string
  pageNum: number
  x: number
  y: number
  width: number
  height: number
  deletedText: string
}

interface ExtractedTextItem {
  id: string
  pageNum: number
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontName: string
  isDeleted: boolean
  isEdited: boolean
  editedText?: string
}

export default function EditorPage() {
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [rotation, setRotation] = useState<number>(0)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentTool, setCurrentTool] = useState<DrawingTool>({
    type: "pen",
    color: "#FF0000",
    size: 3,
    fill: false,
    fillColor: "#FF0000",
  })
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [tempCanvas, setTempCanvas] = useState<HTMLCanvasElement | null>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [canvasAnnotations, setCanvasAnnotations] = useState<Map<number, string>>(new Map())
  const [currentDocument, setCurrentDocument] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [isClient, setIsClient] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [textEdits, setTextEdits] = useState<Map<number, TextEdit[]>>(new Map())
  const [activeTextEdit, setActiveTextEdit] = useState<TextEdit | null>(null)
  const [isTextMode, setIsTextMode] = useState(false)
  const [draggedTextId, setDraggedTextId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [textReplacements, setTextReplacements] = useState<Map<number, TextReplacement[]>>(new Map())
  const [textDeletions, setTextDeletions] = useState<Map<number, TextDeletion[]>>(new Map())
  const [selectedTextElement, setSelectedTextElement] = useState<any>(null)
  const [isTextLayerEnabled, setIsTextLayerEnabled] = useState(false)
  const [textInteractionMode, setTextInteractionMode] = useState<"edit" | "delete">("edit")
  
  // New state for extracted text content system
  const [extractedTextContent, setExtractedTextContent] = useState<Map<number, ExtractedTextItem[]>>(new Map())
  const [isTextExtractionComplete, setIsTextExtractionComplete] = useState(false)
  const [selectedTextItem, setSelectedTextItem] = useState<ExtractedTextItem | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()
  const docId = searchParams.get("doc")
  const { toast } = useToast()

  useEffect(() => {
    setIsClient(true)
    checkAuth()
    
    // Test PDF.js initialization
    if (typeof window !== 'undefined') {
      console.log('Testing PDF.js initialization...')
      setTimeout(() => {
        import("react-pdf").then((mod) => {
          console.log('React-PDF loaded:', !!mod.pdfjs)
          console.log('PDF.js version:', mod.pdfjs?.version || 'unknown')
          console.log('Worker source:', mod.pdfjs?.GlobalWorkerOptions?.workerSrc || 'not set')
          
          // Test if worker file is accessible
          fetch('/pdf.worker.min.js')
            .then(response => {
              console.log('Worker file accessible:', response.ok, response.status)
            })
            .catch(error => {
              console.error('Worker file not accessible:', error)
            })
        }).catch((error) => {
          console.error('React-PDF import failed:', error)
        })
      }, 1000)
    }
  }, [])

  useEffect(() => {
    if (docId && user) {
      loadDocument(docId)
    } else {
      setLoading(false)
    }
  }, [docId, user])

  // Re-setup text selection when tool or mode changes
  useEffect(() => {
    if (isClient) {
      setTimeout(() => {
        setupTextSelection()
      }, 300)
      
      // Extract text content when text tool is activated
      if (currentTool.type === "text" && !isTextExtractionComplete && (pdfFile || pdfUrl)) {
        setTimeout(() => {
          extractTextContent()
        }, 1000)
      }
    }
  }, [currentTool.type, textInteractionMode, isClient, currentPage])

  // Update text layer visibility when modifications change
  useEffect(() => {
    if (isClient) {
      setTimeout(() => {
        setupTextSelection()
      }, 100) // Quick update when modifications change
    }
  }, [
    extractedTextContent.get(currentPage),
    textDeletions.get(currentPage),
    textReplacements.get(currentPage),
    textEdits.get(currentPage),
    isClient
  ])

  const checkAuth = async () => {
    try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session) {
      const { data: profile } = await supabase.from("users").select("*").eq("id", session.user.id).single()

      if (profile) {
        setUser(profile)
      }
      }
    } catch (error) {
      console.error("Auth check failed:", error)
    }
  }

  const loadDocument = async (documentId: string) => {
    try {
      setLoading(true)
      // Get document details
      const { data: doc, error: docError } = await supabase.from("documents").select("*").eq("id", documentId).single()

      if (docError || !doc) {
        setError("Failed to load document")
        toast({
          title: "Error",
          description: "Failed to load document",
          variant: "destructive",
        })
        return
      }

      setCurrentDocument(doc)

      // Get signed URL for the PDF file
      const { data: urlData, error: urlError } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 3600)

      if (urlError || !urlData?.signedUrl) {
        setError("Failed to load PDF file")
        toast({
          title: "Error",
          description: "Failed to load PDF file",
          variant: "destructive",
        })
        return
      }

      setPdfUrl(urlData.signedUrl)

      // Load annotations for this document
      const { data: annotationsData, error: annotationsError } = await supabase
        .from("annotations")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: true })

      if (!annotationsError && annotationsData) {
        setAnnotations(annotationsData)
      }
    } catch (error) {
      console.error("Failed to load document:", error)
      setError("Failed to load document")
      toast({
        title: "Error",
        description: "Failed to load document",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    console.log('File selected:', file ? { name: file.name, type: file.type, size: file.size } : 'No file')
    
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file",
        variant: "destructive",
      })
      return
    }

    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid file",
        description: `Selected file type: ${file.type}. Please select a PDF file.`,
        variant: "destructive",
      })
      return
    }

    console.log('Setting PDF file:', file.name)
    setPdfFile(file)
    setCurrentPage(1)
    setPdfUrl(null)
    setCurrentDocument(null)
    setError("")
    setCanvasAnnotations(new Map())
    setHasUnsavedChanges(false)
    
    toast({
      title: "File loaded",
      description: `Loaded: ${file.name}`,
    })
  }

  // Extract text content from PDF for editing
  const extractTextContent = async () => {
    if (!pdfFile && !pdfUrl) return
    
    try {
      setIsTextExtractionComplete(false)
      toast({
        title: "Extracting Text",
        description: "Extracting text content from PDF...",
      })

      // Get PDF document
      let pdfBytes: ArrayBuffer
      if (pdfFile) {
        pdfBytes = await pdfFile.arrayBuffer()
      } else if (pdfUrl) {
        const response = await fetch(pdfUrl)
        pdfBytes = await response.arrayBuffer()
      } else {
        throw new Error("No PDF source available")
      }

      // Load PDF with pdf-lib to extract text
      const pdfDoc = await PDFDocument.load(pdfBytes)
      const pages = pdfDoc.getPages()
      const newExtractedContent = new Map<number, ExtractedTextItem[]>()

      // For each page, extract text items with positioning
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const pageNum = pageIndex + 1
        const page = pages[pageIndex]
        
        // Get text content using react-pdf's text layer if available
        const textItems = await extractTextFromPage(pageNum)
        
        if (textItems.length > 0) {
          newExtractedContent.set(pageNum, textItems)
        }
      }

      setExtractedTextContent(newExtractedContent)
      setIsTextExtractionComplete(true)

      toast({
        title: "Text Extraction Complete",
        description: `Extracted text from ${newExtractedContent.size} pages`,
      })

    } catch (error) {
      console.error("Text extraction failed:", error)
      toast({
        title: "Text Extraction Failed",
        description: "Failed to extract text content",
        variant: "destructive",
      })
    }
  }

  // Extract text from a specific page using DOM text layer
  const extractTextFromPage = async (pageNum: number): Promise<ExtractedTextItem[]> => {
    return new Promise((resolve) => {
      // Wait for text layer to be rendered
      setTimeout(() => {
        const textLayer = document.querySelector('.react-pdf__Page__textContent')
        if (!textLayer) {
          resolve([])
          return
        }

        const textSpans = textLayer.querySelectorAll('span')
        const extractedItems: ExtractedTextItem[] = []

        // Group adjacent text spans to form complete words/phrases
        const groupedTextItems: Array<{
          spans: HTMLElement[],
          text: string,
          bounds: { left: number, top: number, right: number, bottom: number }
        }> = []

        const spanArray = Array.from(textSpans) as HTMLElement[]
        
        spanArray.forEach((span, index) => {
          const rect = span.getBoundingClientRect()
          const containerRect = textLayer.getBoundingClientRect()
          
          if (rect.width > 0 && rect.height > 0 && span.textContent?.trim()) {
            const relativeRect = {
              left: rect.left - containerRect.left,
              top: rect.top - containerRect.top,
              right: rect.right - containerRect.left,
              bottom: rect.bottom - containerRect.top
            }

            // Try to group with the previous item if they're close together
            const lastGroup = groupedTextItems[groupedTextItems.length - 1]
            const verticalTolerance = 5 // pixels
            const horizontalGap = 10 // pixels

            if (lastGroup && 
                Math.abs(lastGroup.bounds.top - relativeRect.top) <= verticalTolerance &&
                Math.abs(lastGroup.bounds.bottom - relativeRect.bottom) <= verticalTolerance &&
                relativeRect.left - lastGroup.bounds.right <= horizontalGap) {
              // Group with previous item
              lastGroup.spans.push(span)
              lastGroup.text += span.textContent
              lastGroup.bounds.right = relativeRect.right
            } else {
              // Create new group
              groupedTextItems.push({
                spans: [span],
                text: span.textContent.trim(),
                bounds: relativeRect
              })
            }
          }
        })

        // Convert grouped items to ExtractedTextItem
        groupedTextItems.forEach((group, index) => {
          if (group.text.trim()) {
            const item: ExtractedTextItem = {
              id: `text-${pageNum}-${index}-${Date.now()}`,
              pageNum: pageNum,
              text: group.text.trim(),
              x: group.bounds.left / scale,
              y: group.bounds.top / scale,
              width: (group.bounds.right - group.bounds.left) / scale,
              height: (group.bounds.bottom - group.bounds.top) / scale,
              fontSize: parseFloat(window.getComputedStyle(group.spans[0]).fontSize) || 12,
              fontName: window.getComputedStyle(group.spans[0]).fontFamily || 'Arial',
              isDeleted: false,
              isEdited: false,
            }
            extractedItems.push(item)
          }
        })

        console.log(`Extracted ${extractedItems.length} text items from page ${pageNum}`)
        resolve(extractedItems)
      }, 500)
    })
  }

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setError("")
    
    // Start text extraction when text mode is active
    if (currentTool.type === "text") {
      setTimeout(() => extractTextContent(), 1000)
    }
  }

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF load error:", error)
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      type: typeof error,
      toString: error.toString()
    })
    
    // Check if it's a worker-related error
    const isWorkerError = error.message.includes('worker') || error.message.includes('Worker') || error.message.includes('module')
    
    setError(`PDF Load Error: ${error.message}`)
    toast({
      title: isWorkerError ? "Worker Configuration Error" : "PDF Load Error", 
      description: isWorkerError ? "PDF worker failed to load. Trying legacy mode." : `Error: ${error.message}`,
      variant: "destructive",
    })
  }

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0))
  }

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5))
  }

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const handlePrevPage = () => {
    saveCurrentPageCanvas()
    // Reset text editing states when changing pages
    setDraggedTextId(null)
    setActiveTextEdit(null)
    setSelectedTextElement(null)
    setTextInteractionMode("select")
    setCurrentPage((prev) => {
      const newPage = Math.max(prev - 1, 1)
      setTimeout(() => restorePageCanvas(newPage), 100)
      return newPage
    })
  }

  const handleNextPage = () => {
    saveCurrentPageCanvas()
    // Reset text editing states when changing pages
    setDraggedTextId(null)
    setActiveTextEdit(null)
    setSelectedTextElement(null)
    setTextInteractionMode("select")
    setCurrentPage((prev) => {
      const newPage = Math.min(prev + 1, numPages)
      setTimeout(() => restorePageCanvas(newPage), 100)
      return newPage
    })
  }

  const saveCurrentPageCanvas = () => {
    if (canvasRef.current) {
      const imageData = canvasRef.current.toDataURL()
      const newAnnotations = new Map(canvasAnnotations)
      newAnnotations.set(currentPage, imageData)
      setCanvasAnnotations(newAnnotations)
    }
  }

  const restorePageCanvas = (page: number) => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
        
        const savedAnnotation = canvasAnnotations.get(page)
        if (savedAnnotation) {
          const img = new Image()
          img.onload = () => {
            ctx.drawImage(img, 0, 0)
          }
          img.src = savedAnnotation
        }
      }
    }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return

    setIsDrawing(true)
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Store starting point for shapes
    setStartPoint({ x, y })

    const ctx = canvasRef.current.getContext("2d")
    if (ctx) {
      // For shapes, we'll draw on mouse move and mouse up
      if (currentTool.type === "rectangle" || currentTool.type === "circle") {
        // Create a temporary canvas for preview
        if (!tempCanvas) {
          const temp = document.createElement('canvas')
          temp.width = canvasRef.current.width
          temp.height = canvasRef.current.height
          setTempCanvas(temp)
        }
        return
      }

      // For freehand drawing tools
      ctx.beginPath()
      ctx.moveTo(x, y)
      // Common stroke settings
      ctx.lineCap = "round"
      ctx.lineJoin = "round"

      // Tool-specific configuration
      if (currentTool.type === "eraser") {
        // Use destination-out to truly erase instead of painting white
        ctx.globalCompositeOperation = "destination-out"
        ctx.strokeStyle = "rgba(0,0,0,1)" // Color doesn't matter in destination-out
        // Slightly larger width than selected size for cleaner edges
        ctx.lineWidth = currentTool.size * 1.5
        ctx.globalAlpha = 1.0
                    } else {
        ctx.strokeStyle = currentTool.color
        ctx.lineWidth = currentTool.size
        if (currentTool.type === "highlighter") {
          ctx.globalCompositeOperation = "multiply"
          ctx.globalAlpha = 0.7
        } else {
          ctx.globalCompositeOperation = "source-over"
          ctx.globalAlpha = 1.0
        }
      }
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current || !startPoint) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const ctx = canvasRef.current.getContext("2d")
    if (!ctx) return

    if (currentTool.type === "rectangle" || currentTool.type === "circle") {
      // Clear and redraw for shape preview
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      
      // Restore any existing annotations for this page
      const existingAnnotation = canvasAnnotations.get(currentPage)
      if (existingAnnotation) {
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0)
          drawShapePreview(ctx, startPoint, { x, y })
        }
        img.src = existingAnnotation
      } else {
        drawShapePreview(ctx, startPoint, { x, y })
      }
    } else {
      // Freehand drawing
      if (currentTool.type === "eraser") {
        ctx.globalCompositeOperation = "destination-out"
        ctx.strokeStyle = "rgba(0,0,0,1)"
        ctx.lineWidth = currentTool.size * 1.5
      }
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  const drawShapePreview = (ctx: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }) => {
    ctx.strokeStyle = currentTool.color
    ctx.lineWidth = currentTool.size
    ctx.globalCompositeOperation = "source-over"
    ctx.globalAlpha = 1.0
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    const width = end.x - start.x
    const height = end.y - start.y

    ctx.beginPath()
    if (currentTool.type === "rectangle") {
      ctx.rect(start.x, start.y, width, height)
    } else if (currentTool.type === "circle") {
      const radius = Math.sqrt(width * width + height * height) / 2
      const centerX = start.x + width / 2
      const centerY = start.y + height / 2
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
    }
    // Fill shape if requested
    if (currentTool.fill) {
      ctx.fillStyle = currentTool.fillColor
      ctx.fill()
    }
    ctx.stroke()
  }

  const handleCanvasMouseUp = async () => {
    if (!isDrawing) return
    setIsDrawing(false)

    // Reset start point for next drawing
    setStartPoint(null)

    // Save canvas state for this page
    if (canvasRef.current) {
      const imageData = canvasRef.current.toDataURL()
      const newAnnotations = new Map(canvasAnnotations)
      newAnnotations.set(currentPage, imageData)
      setCanvasAnnotations(newAnnotations)
      setHasUnsavedChanges(true)
    }

    // Save annotation to database if we have a current document
    if (currentDocument && user && canvasRef.current) {
      try {
        const canvas = canvasRef.current
        const imageData = canvas.toDataURL()

        const { error } = await supabase.from("annotations").insert([
          {
            document_id: currentDocument.id,
            user_id: user.id,
            page_number: currentPage,
            type: currentTool.type,
            data: {
              imageData,
              tool: currentTool,
            },
          },
        ])

        if (error) {
          console.error("Failed to save annotation:", error)
          toast({
            title: "Error",
            description: "Failed to save annotation",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Annotation save failed:", error)
      }
    }
  }

  const clearCanvas = () => {
    if (!canvasRef.current) return
      const ctx = canvasRef.current.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      
      // Remove annotations for current page
      const newAnnotations = new Map(canvasAnnotations)
      newAnnotations.delete(currentPage)
      setCanvasAnnotations(newAnnotations)
      setHasUnsavedChanges(newAnnotations.size > 0 || textEdits.size > 0 || textReplacements.size > 0 || textDeletions.size > 0)
    }
  }

  const clearAllAnnotations = () => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext("2d")
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      setCanvasAnnotations(new Map())
      setTextEdits(new Map())
      setTextReplacements(new Map())
      setTextDeletions(new Map())
      setSelectedTextElement(null)
      setHasUnsavedChanges(false)
      
      toast({
        title: "Success",
        description: "All annotations, text edits, replacements, and deletions cleared",
      })
    }
  }

  // Text editing functions
  const handleTextClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (currentTool.type !== "text") return

    // Don't create new text if clicking on existing text layer
    const target = e.target as HTMLElement
    if (target.closest('.react-pdf__Page__textContent')) {
      return // Let text selection handle this
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    // Create a new text edit at the clicked position
    const newTextEdit: TextEdit = {
      id: Date.now().toString(),
      pageNum: currentPage,
      x,
      y,
      width: 200,
      height: 30,
      originalText: "",
      newText: "",
      fontSize: 16,
      fontColor: currentTool.color,
    }

    setActiveTextEdit(newTextEdit)
  }

  const saveTextEdit = (textEdit: TextEdit) => {
    if (!textEdit.newText.trim()) {
      setActiveTextEdit(null)
      return
    }

    const pageEdits = textEdits.get(currentPage) || []
    const existingIndex = pageEdits.findIndex(edit => edit.id === textEdit.id)

    if (existingIndex >= 0) {
      pageEdits[existingIndex] = textEdit
    } else {
      pageEdits.push(textEdit)
    }

    const newTextEdits = new Map(textEdits)
    newTextEdits.set(currentPage, pageEdits)
    setTextEdits(newTextEdits)
    setActiveTextEdit(null)
    setHasUnsavedChanges(true)

    toast({
      title: "Text Added",
      description: "Text edit saved successfully",
    })
  }

  const deleteTextEdit = (editId: string) => {
    const pageEdits = textEdits.get(currentPage) || []
    const filteredEdits = pageEdits.filter(edit => edit.id !== editId)
    
    const newTextEdits = new Map(textEdits)
    if (filteredEdits.length === 0) {
      newTextEdits.delete(currentPage)
    } else {
      newTextEdits.set(currentPage, filteredEdits)
    }
    
    setTextEdits(newTextEdits)
    setHasUnsavedChanges(true)
  }

  const clearCurrentPageTexts = () => {
    const newTextEdits = new Map(textEdits)
    newTextEdits.delete(currentPage)
    setTextEdits(newTextEdits)
    setHasUnsavedChanges(newTextEdits.size > 0)
    
    toast({
      title: "Success",
      description: "Text edits cleared for current page",
    })
  }

  // Text dragging functions
  const handleTextMouseDown = (e: React.MouseEvent, textEdit: TextEdit) => {
    e.stopPropagation()
    e.preventDefault()
    
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    
    setDraggedTextId(textEdit.id)
    setDragOffset({ x: offsetX, y: offsetY })
  }

  const handleTextMouseMove = (e: React.MouseEvent) => {
    if (!draggedTextId) return
    
    const container = e.currentTarget.getBoundingClientRect()
    const newX = (e.clientX - container.left - dragOffset.x) / scale
    const newY = (e.clientY - container.top - dragOffset.y) / scale
    
    // Update the position of the dragged text
    const pageEdits = textEdits.get(currentPage) || []
    const updatedEdits = pageEdits.map(edit => 
      edit.id === draggedTextId 
        ? { ...edit, x: Math.max(0, newX), y: Math.max(0, newY) }
        : edit
    )
    
    const newTextEdits = new Map(textEdits)
    newTextEdits.set(currentPage, updatedEdits)
    setTextEdits(newTextEdits)
  }

  const handleTextMouseUp = () => {
    if (draggedTextId) {
      setDraggedTextId(null)
      setDragOffset({ x: 0, y: 0 })
      setHasUnsavedChanges(true)
      
      toast({
        title: "Text Moved",
        description: "Text position updated successfully",
      })
    }
  }

    // Manage text layer visibility (completely disabled old selection system)
  const setupTextSelection = () => {
    const textLayer = document.querySelector('.react-pdf__Page__textContent')
    console.log("Managing text layer visibility, found:", !!textLayer)
    console.log("Current tool:", currentTool.type)    
    console.log("Text extraction complete:", isTextExtractionComplete)

    if (textLayer) {
      // COMPLETELY remove all old text selection functionality
      textLayer.removeEventListener('mouseup', handleTextSelection)
      textLayer.removeEventListener('touchend', handleTextSelection)
      textLayer.removeEventListener('mousedown', handleTextSelectionMouseDown)

      // Check if there are any text modifications on the current page
      const hasTextModifications = 
        (extractedTextContent.get(currentPage)?.some(item => item.isDeleted || item.isEdited)) ||
        (textDeletions.get(currentPage)?.length > 0) ||
        (textReplacements.get(currentPage)?.length > 0) ||
        (textEdits.get(currentPage)?.length > 0)

      // ALWAYS disable old text layer interaction - only use extracted text system
      textLayer.style.pointerEvents = "none"
      textLayer.style.userSelect = "none"
      textLayer.style.zIndex = "1" // Lower z-index so overlays appear on top
      
      if (currentTool.type === "text" && isTextExtractionComplete) {
        // Completely hide original text when text tool is active and extraction is complete
        if (hasTextModifications) {
          textLayer.style.opacity = "0" // Completely hidden when modifications exist
          textLayer.style.visibility = "hidden"
        } else {
          textLayer.style.opacity = "0.05" // Almost invisible when no modifications
          textLayer.style.visibility = "visible"
        }
      } else if (currentTool.type === "text") {
        // Very faded during extraction
        textLayer.style.opacity = "0.2"
        textLayer.style.visibility = "visible"
      } else {
        // Normal or hidden based on modifications when not in text mode
        textLayer.style.opacity = hasTextModifications ? "0" : "1"
        textLayer.style.visibility = hasTextModifications ? "hidden" : "visible"
      }

      // Remove any interactive styling from text spans (disable old system completely)
      const textSpans = textLayer.querySelectorAll('span')
      textSpans.forEach(span => {
        span.style.cursor = "default"
        span.style.userSelect = "none"
        span.style.pointerEvents = "none"
        span.style.padding = "0"
        span.style.backgroundColor = "transparent"
        span.style.border = "none"
        // Remove all old event listeners
        span.removeEventListener('mouseenter', () => {})
        span.removeEventListener('mouseleave', () => {})
      })
    } else {
      console.log("Text layer not found, retrying in 500ms...")
      setTimeout(setupTextSelection, 500)
    }
  }

  const handleTextSelectionMouseDown = (event: any) => {
    if (currentTool.type === "text") {
      event.stopPropagation()
    }
  }

  // OLD TEXT SELECTION FUNCTIONS - DISABLED IN FAVOR OF EXTRACTED TEXT SYSTEM
  const handleTextSelection = (event: any) => {
    // DISABLED - Use extracted text system instead
    console.log("Old text selection disabled - use extracted text system")
    return
  }

  const deleteSelectedText = (selectedText: any) => {
    // DISABLED - Use extracted text system instead
    console.log("Old deleteSelectedText disabled - use extracted text system")
    return
  }

  const createTextReplacement = (selectedText: any, newText: string) => {
    if (!selectedText || !newText.trim()) return
    
    const replacement: TextReplacement = {
      id: Date.now().toString(),
      pageNum: currentPage,
      x: selectedText.x,
      y: selectedText.y,
      width: Math.max(selectedText.width, 100),
      height: Math.max(selectedText.height, 20),
      originalText: selectedText.text,
      newText: newText,
      fontSize: Math.max(Math.round(selectedText.height * 0.8), 12),
      fontColor: currentTool.color,
      backgroundColor: "#FFFFFF"
    }
    
    const pageReplacements = textReplacements.get(currentPage) || []
    pageReplacements.push(replacement)
    
    const newTextReplacements = new Map(textReplacements)
    newTextReplacements.set(currentPage, pageReplacements)
    setTextReplacements(newTextReplacements)
    setSelectedTextElement(null)
    setHasUnsavedChanges(true)
    
    toast({
      title: "Text Replaced",
      description: `"${selectedText.text}" replaced with "${newText}"`,
    })
  }

  const deleteTextReplacement = (replacementId: string) => {
    const pageReplacements = textReplacements.get(currentPage) || []
    const filteredReplacements = pageReplacements.filter(r => r.id !== replacementId)
    
    const newTextReplacements = new Map(textReplacements)
    if (filteredReplacements.length === 0) {
      newTextReplacements.delete(currentPage)
    } else {
      newTextReplacements.set(currentPage, filteredReplacements)
    }
    
    setTextReplacements(newTextReplacements)
    setHasUnsavedChanges(true)
  }

  const clearCurrentPageReplacements = () => {
    const newTextReplacements = new Map(textReplacements)
    newTextReplacements.delete(currentPage)
    setTextReplacements(newTextReplacements)
    setHasUnsavedChanges(newTextReplacements.size > 0 || textEdits.size > 0 || canvasAnnotations.size > 0 || textDeletions.size > 0)
    
    toast({
      title: "Success",
      description: "Text replacements cleared for current page",
    })
  }

  const deleteTextDeletion = (deletionId: string) => {
    const pageDeletions = textDeletions.get(currentPage) || []
    const filteredDeletions = pageDeletions.filter(d => d.id !== deletionId)
    
    const newTextDeletions = new Map(textDeletions)
    if (filteredDeletions.length === 0) {
      newTextDeletions.delete(currentPage)
    } else {
      newTextDeletions.set(currentPage, filteredDeletions)
    }
    
    setTextDeletions(newTextDeletions)
    setHasUnsavedChanges(true)
  }

  const clearCurrentPageDeletions = () => {
    const newTextDeletions = new Map(textDeletions)
    newTextDeletions.delete(currentPage)
    setTextDeletions(newTextDeletions)
    setHasUnsavedChanges(newTextDeletions.size > 0 || textEdits.size > 0 || canvasAnnotations.size > 0 || textReplacements.size > 0)
    
    toast({
      title: "Success",
      description: "Text deletions cleared for current page",
    })
  }

  // Functions for extracted text content editing
  const handleExtractedTextClick = (textItem: ExtractedTextItem) => {
    if (textInteractionMode === "delete") {
      deleteExtractedTextItem(textItem.id)
    } else {
      setSelectedTextItem(textItem)
    }
  }

  const deleteExtractedTextItem = (textId: string) => {
    const pageItems = extractedTextContent.get(currentPage) || []
    const updatedItems = pageItems.map(item =>
      item.id === textId ? { 
        ...item, 
        isDeleted: true,
        isEdited: false,
        editedText: undefined,
        // Expand the deletion area for complete coverage
        x: Math.max(0, item.x - 4), // Extra padding left
        y: Math.max(0, item.y - 3), // Extra padding top
        width: item.width + 8, // Extra width for full coverage
        height: Math.max(item.height + 6, 20) // Extra height, minimum 20px
      } : item
    )

    const newExtractedContent = new Map(extractedTextContent)
    newExtractedContent.set(currentPage, updatedItems)
    setExtractedTextContent(newExtractedContent)
    setHasUnsavedChanges(true)

    const deletedItem = pageItems.find(item => item.id === textId)
    toast({
      title: "✅ Text Completely Deleted",
      description: `"${deletedItem?.text || 'Text'}" has been completely removed`,
    })
  }

  const editExtractedTextItem = (textId: string, newText: string) => {
    const pageItems = extractedTextContent.get(currentPage) || []
    const updatedItems = pageItems.map(item =>
      item.id === textId 
        ? { ...item, isEdited: true, editedText: newText }
        : item
    )

    const newExtractedContent = new Map(extractedTextContent)
    newExtractedContent.set(currentPage, updatedItems)
    setExtractedTextContent(newExtractedContent)
    setSelectedTextItem(null)
    setHasUnsavedChanges(true)

    toast({
      title: "Text Edited",
      description: "Text has been updated",
    })
  }

  const restoreExtractedTextItem = (textId: string) => {
    const pageItems = extractedTextContent.get(currentPage) || []
    const updatedItems = pageItems.map(item =>
      item.id === textId 
        ? { ...item, isDeleted: false, isEdited: false, editedText: undefined }
        : item
    )

    const newExtractedContent = new Map(extractedTextContent)
    newExtractedContent.set(currentPage, updatedItems)
    setExtractedTextContent(newExtractedContent)
    setHasUnsavedChanges(true)

    toast({
      title: "Text Restored",
      description: "Text has been restored",
    })
  }

  const saveDocument = async () => {
    if (!hasUnsavedChanges && canvasAnnotations.size === 0 && textEdits.size === 0 && textReplacements.size === 0 && textDeletions.size === 0) {
      toast({
        title: "Info",
        description: "No changes to save",
      })
      return
    }

    try {
      // Save current page canvas before saving
      saveCurrentPageCanvas()
      
      // Here you could save the annotations to the database
      // For now, we'll just mark as saved
      setHasUnsavedChanges(false)
      
      toast({
        title: "Success",
        description: "Annotations saved successfully",
      })
    } catch (error) {
      console.error("Save failed:", error)
      toast({
        title: "Error",
        description: "Failed to save annotations",
        variant: "destructive",
      })
    }
  }

  const downloadPDF = async () => {
    if (!pdfFile && !pdfUrl) {
      toast({
        title: "Error",
        description: "No PDF to download",
        variant: "destructive",
      })
          return
        }

    try {
      // Save current page canvas before downloading
      saveCurrentPageCanvas()

      if (canvasAnnotations.size > 0 || textEdits.size > 0 || textReplacements.size > 0 || textDeletions.size > 0) {
        // Create edited PDF with annotations, text edits, text replacements, and/or text deletions
        await downloadEditedPDF()
      } else {
        // Download original PDF if no changes
        await downloadOriginalPDF()
        }
      } catch (error) {
      console.error("Download failed:", error)
      toast({
        title: "Error",
        description: "Failed to download PDF",
        variant: "destructive",
      })
    }
  }

  const downloadOriginalPDF = async () => {
    if (pdfFile) {
      const url = URL.createObjectURL(pdfFile)
      const a = document.createElement("a")
      a.href = url
      a.download = pdfFile.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else if (pdfUrl) {
      const a = document.createElement("a")
      a.href = pdfUrl
      a.download = currentDocument?.name || "document.pdf"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

    const enhanceAnnotationForPDF = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    // Create enhanced canvas with more prominent annotations
    const enhancedCanvas = document.createElement('canvas')
    const enhancedCtx = enhancedCanvas.getContext('2d')
    enhancedCanvas.width = canvas.width
    enhancedCanvas.height = canvas.height
    
    if (enhancedCtx) {
      // Fill with transparent background
      enhancedCtx.clearRect(0, 0, enhancedCanvas.width, enhancedCanvas.height)
      
      // Draw the original annotations
      enhancedCtx.drawImage(canvas, 0, 0)
      
      // Apply enhancement filter to make annotations more prominent
      const imageData = enhancedCtx.getImageData(0, 0, enhancedCanvas.width, enhancedCanvas.height)
      const data = imageData.data
      
      // Enhance contrast and opacity of non-transparent pixels
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3]
        if (alpha > 0) {
          // Increase contrast and make colors more vibrant
          data[i] = Math.min(255, data[i] * 1.2)     // Red
          data[i + 1] = Math.min(255, data[i + 1] * 1.2) // Green
          data[i + 2] = Math.min(255, data[i + 2] * 1.2) // Blue
          data[i + 3] = Math.min(255, alpha * 1.3)       // Alpha (more opaque)
        }
      }
      
      enhancedCtx.putImageData(imageData, 0, 0)
    }
    
    return enhancedCanvas
  }

  // Generate edited PDF and open in new tab for preview
  const previewEditedPDF = async () => {
    try {
      toast({
        title: "Generating Preview",
        description: "Creating a preview of the edited PDF...",
      })

      // Get the original PDF bytes
      let pdfBytes: ArrayBuffer

      if (pdfFile) {
        pdfBytes = await pdfFile.arrayBuffer()
      } else if (pdfUrl) {
        const response = await fetch(pdfUrl)
        pdfBytes = await response.arrayBuffer()
      } else {
        throw new Error("No PDF source available")
      }

      // Load the PDF with pdf-lib
      const pdfDoc = await PDFDocument.load(pdfBytes)
      const pages = pdfDoc.getPages()

      // Apply all edits to the PDF - same logic as downloadEditedPDF
      
      // Add annotations to each page that has them
      for (const [pageNum, annotationData] of canvasAnnotations.entries()) {
        if (pageNum <= pages.length && annotationData) {
          const page = pages[pageNum - 1] // pdf-lib uses 0-based indexing
          
          // Convert canvas annotation to image
          const img = new Image()
          img.src = annotationData
          
          await new Promise((resolve) => {
            img.onload = async () => {
              // Create a canvas to get the image data
              const tempCanvas = document.createElement('canvas')
              const tempCtx = tempCanvas.getContext('2d')
              tempCanvas.width = img.width
              tempCanvas.height = img.height
              
              if (tempCtx) {
                tempCtx.drawImage(img, 0, 0)
                
                // Enhance the annotation for PDF prominence
                const enhancedCanvas = enhanceAnnotationForPDF(tempCanvas)
                
                // Convert enhanced canvas to PNG bytes
                const pngDataUrl = enhancedCanvas.toDataURL('image/png', 1.0)
                const pngBytes = pngDataUrl.split(',')[1]
                const pngBuffer = Uint8Array.from(atob(pngBytes), c => c.charCodeAt(0))
                
                try {
                  // Embed the enhanced annotation image
                  const annotationImage = await pdfDoc.embedPng(pngBuffer)
                  const { width, height } = page.getSize()
                  
                  // Scale the annotation to fit the page exactly
                  const annotationDims = annotationImage.scale(width / img.width)
                  
                  // Draw the annotation prominently on the page (fully opaque)
                  page.drawImage(annotationImage, {
                    x: 0,
                    y: height - annotationDims.height,
                    width: annotationDims.width,
                    height: annotationDims.height,
                    opacity: 1.0, // Fully opaque for maximum prominence
                  })
                } catch (embedError) {
                  console.warn(`Failed to embed annotation for page ${pageNum}:`, embedError)
                }
              }
              resolve(void 0)
            }
          })
        }
      }

      // Add text edits to each page that has them
      for (const [pageNum, pageTextEdits] of textEdits.entries()) {
        if (pageNum <= pages.length && pageTextEdits.length > 0) {
          const page = pages[pageNum - 1] // pdf-lib uses 0-based indexing
          const { height: pageHeight } = page.getSize()

          for (const textEdit of pageTextEdits) {
            try {
              // Convert hex color to RGB
              const hexToRgb = (hex: string) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
                return result ? {
                  r: parseInt(result[1], 16) / 255,
                  g: parseInt(result[2], 16) / 255,
                  b: parseInt(result[3], 16) / 255
                } : { r: 0, g: 0, b: 0 }
              }

              const color = hexToRgb(textEdit.fontColor)

              // Draw text on the page
              page.drawText(textEdit.newText, {
                x: textEdit.x,
                y: pageHeight - textEdit.y - textEdit.fontSize, // PDF coordinates are bottom-up
                size: textEdit.fontSize,
                color: rgb(color.r, color.g, color.b),
              })
            } catch (textError) {
              console.warn(`Failed to add text edit for page ${pageNum}:`, textError)
            }
          }
        }
      }

      // Add text replacements to each page that has them
      for (const [pageNum, pageReplacements] of textReplacements.entries()) {
        if (pageNum <= pages.length && pageReplacements.length > 0) {
          const page = pages[pageNum - 1] // pdf-lib uses 0-based indexing
          const { height: pageHeight } = page.getSize()

          for (const replacement of pageReplacements) {
            try {
              // Convert hex color to RGB
              const hexToRgb = (hex: string) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
                return result ? {
                  r: parseInt(result[1], 16) / 255,
                  g: parseInt(result[2], 16) / 255,
                  b: parseInt(result[3], 16) / 255
                } : { r: 0, g: 0, b: 0 }
              }

              const textColor = hexToRgb(replacement.fontColor)

              // Mask the original text completely before drawing replacement
              maskOriginalText(page, {
                x: replacement.x,
                y: pageHeight - replacement.y - replacement.height,
                width: replacement.width,
                height: replacement.height,
              })

              // Draw replacement text on top
              page.drawText(replacement.newText, {
                x: replacement.x + 2, // Small padding
                y: pageHeight - replacement.y - replacement.fontSize + 2, // Adjust for text baseline
                size: replacement.fontSize,
                color: rgb(textColor.r, textColor.g, textColor.b),
              })
            } catch (replacementError) {
              console.warn(`Failed to add text replacement for page ${pageNum}:`, replacementError)
            }
          }
        }
      }

      // Handle text deletions by masking them
      for (const [pageNum, pageDeletions] of textDeletions.entries()) {
        if (pageNum <= pages.length && pageDeletions.length > 0) {
          const page = pages[pageNum - 1]
          const { height: pageHeight } = page.getSize()

          for (const deletion of pageDeletions) {
            try {
              // Mask the deleted text area
              maskOriginalText(page, {
                x: deletion.x,
                y: pageHeight - deletion.y - deletion.height,
                width: deletion.width,
                height: deletion.height,
              })
            } catch (deletionError) {
              console.warn(`Failed to apply text deletion for page ${pageNum}:`, deletionError)
            }
          }
        }
      }

      // Handle extracted text edits and deletions
      for (const [pageNum, extractedItems] of extractedTextContent.entries()) {
        if (pageNum <= pages.length && extractedItems.length > 0) {
          const page = pages[pageNum - 1]
          const { height: pageHeight } = page.getSize()

          for (const item of extractedItems) {
            try {
              if (item.isDeleted) {
                // Mask deleted text
                maskOriginalText(page, {
                  x: item.x,
                  y: pageHeight - item.y - item.height,
                  width: item.width,
                  height: item.height,
                })
              } else if (item.isEdited && item.editedText) {
                // Replace with edited text
                maskOriginalText(page, {
                  x: item.x,
                  y: pageHeight - item.y - item.height,
                  width: item.width,
                  height: item.height,
                })

                // Draw new text
                page.drawText(item.editedText, {
                  x: item.x + 2,
                  y: pageHeight - item.y - item.fontSize + 2,
                  size: item.fontSize,
                  color: rgb(0, 0, 0), // Default black color
                })
              }
            } catch (extractedError) {
              console.warn(`Failed to apply extracted text edit for page ${pageNum}:`, extractedError)
            }
          }
        }
      }

      // Save the modified PDF
      const editedBytes = await pdfDoc.save()
      const blob = new Blob([editedBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      window.open(url, '_blank')

      toast({
        title: "Preview Ready",
        description: "Preview opened in new tab with all edits applied.",
      })

    } catch (error) {
      console.error("Preview generation failed:", error)
      toast({
        title: "Error",
        description: "Failed to generate preview",
        variant: "destructive",
      })
    }
  }

  const downloadEditedPDF = async () => {
    try {
      toast({
        title: "Processing",
        description: "Creating edited PDF with prominent annotations...",
      })

      // Get the original PDF bytes
      let pdfBytes: ArrayBuffer

      if (pdfFile) {
        pdfBytes = await pdfFile.arrayBuffer()
      } else if (pdfUrl) {
        const response = await fetch(pdfUrl)
        pdfBytes = await response.arrayBuffer()
    } else {
        throw new Error("No PDF source available")
      }

      // Load the PDF with pdf-lib
      const pdfDoc = await PDFDocument.load(pdfBytes)
      const pages = pdfDoc.getPages()

      // Add annotations to each page that has them
      for (const [pageNum, annotationData] of canvasAnnotations.entries()) {
        if (pageNum <= pages.length && annotationData) {
          const page = pages[pageNum - 1] // pdf-lib uses 0-based indexing
          
          // Convert canvas annotation to image
          const img = new Image()
          img.src = annotationData
          
          await new Promise((resolve) => {
            img.onload = async () => {
              // Create a canvas to get the image data
              const tempCanvas = document.createElement('canvas')
              const tempCtx = tempCanvas.getContext('2d')
              tempCanvas.width = img.width
              tempCanvas.height = img.height
              
              if (tempCtx) {
                tempCtx.drawImage(img, 0, 0)
                
                // Enhance the annotation for PDF prominence
                const enhancedCanvas = enhanceAnnotationForPDF(tempCanvas)
                
                // Convert enhanced canvas to PNG bytes
                const pngDataUrl = enhancedCanvas.toDataURL('image/png', 1.0)
                const pngBytes = pngDataUrl.split(',')[1]
                const pngBuffer = Uint8Array.from(atob(pngBytes), c => c.charCodeAt(0))
                
                try {
                  // Embed the enhanced annotation image
                  const annotationImage = await pdfDoc.embedPng(pngBuffer)
                  const { width, height } = page.getSize()
                  
                  // Scale the annotation to fit the page exactly
                  const annotationDims = annotationImage.scale(width / img.width)
                  
                  // Draw the annotation prominently on the page (fully opaque)
                  page.drawImage(annotationImage, {
                    x: 0,
                    y: height - annotationDims.height,
                    width: annotationDims.width,
                    height: annotationDims.height,
                    opacity: 1.0, // Fully opaque for maximum prominence
                  })
                } catch (embedError) {
                  console.warn(`Failed to embed annotation for page ${pageNum}:`, embedError)
                }
              }
              resolve(void 0)
            }
          })
        }
      }

      // Add text edits to each page that has them
      for (const [pageNum, pageTextEdits] of textEdits.entries()) {
        if (pageNum <= pages.length && pageTextEdits.length > 0) {
          const page = pages[pageNum - 1] // pdf-lib uses 0-based indexing
          const { height: pageHeight } = page.getSize()

          for (const textEdit of pageTextEdits) {
            try {
              // Convert hex color to RGB
              const hexToRgb = (hex: string) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
                return result ? {
                  r: parseInt(result[1], 16) / 255,
                  g: parseInt(result[2], 16) / 255,
                  b: parseInt(result[3], 16) / 255
                } : { r: 0, g: 0, b: 0 }
              }

              const color = hexToRgb(textEdit.fontColor)

              // Draw text on the page
              page.drawText(textEdit.newText, {
                x: textEdit.x,
                y: pageHeight - textEdit.y - textEdit.fontSize, // PDF coordinates are bottom-up
                size: textEdit.fontSize,
                color: rgb(color.r, color.g, color.b),
              })
            } catch (textError) {
              console.warn(`Failed to add text edit for page ${pageNum}:`, textError)
            }
          }
        }
      }

      // Add text replacements to each page that has them
      for (const [pageNum, pageReplacements] of textReplacements.entries()) {
        if (pageNum <= pages.length && pageReplacements.length > 0) {
          const page = pages[pageNum - 1] // pdf-lib uses 0-based indexing
          const { height: pageHeight } = page.getSize()

          for (const replacement of pageReplacements) {
            try {
              // Convert hex color to RGB
              const hexToRgb = (hex: string) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
                return result ? {
                  r: parseInt(result[1], 16) / 255,
                  g: parseInt(result[2], 16) / 255,
                  b: parseInt(result[3], 16) / 255
                } : { r: 0, g: 0, b: 0 }
              }

              const textColor = hexToRgb(replacement.fontColor)

              // Mask the original text completely before drawing replacement
              maskOriginalText(page, {
                x: replacement.x,
                y: pageHeight - replacement.y - replacement.height,
                width: replacement.width,
                height: replacement.height,
              })

              // Draw replacement text on top
              page.drawText(replacement.newText, {
                x: replacement.x + 2, // Small padding
                y: pageHeight - replacement.y - replacement.fontSize + 2, // Adjust for text baseline
                size: replacement.fontSize,
                color: rgb(textColor.r, textColor.g, textColor.b),
              })
            } catch (replacementError) {
              console.warn(`Failed to add text replacement for page ${pageNum}:`, replacementError)
            }
          }
        }
      }

      // Process extracted text content modifications
      for (const [pageNum, textItems] of extractedTextContent.entries()) {
        if (pageNum <= pages.length && textItems.length > 0) {
          const page = pages[pageNum - 1] // pdf-lib uses 0-based indexing
          const { height: pageHeight } = page.getSize()

          for (const textItem of textItems) {
            try {
              if (textItem.isDeleted) {
                // Apply triple-layer white mask
                maskOriginalText(page, {
                  x: textItem.x,
                  y: pageHeight - textItem.y - textItem.height,
                  width: textItem.width,
                  height: textItem.height,
                })
              } else if (textItem.isEdited && textItem.editedText) {
                // Mask original then draw edited text
                maskOriginalText(page, {
                  x: textItem.x,
                  y: pageHeight - textItem.y - textItem.height,
                  width: textItem.width,
                  height: textItem.height,
                })
                
                // Draw edited text
                page.drawText(textItem.editedText, {
                  x: textItem.x,
                  y: pageHeight - textItem.y - textItem.fontSize,
                  size: textItem.fontSize,
                  color: rgb(0, 0, 0), // Black text
                })
              }
            } catch (textError) {
              console.warn(`Failed to process text item for page ${pageNum}:`, textError)
            }
          }
        }
      }

      // Add text deletions to each page that has them (legacy support)
      for (const [pageNum, pageDeletions] of textDeletions.entries()) {
        if (pageNum <= pages.length && pageDeletions.length > 0) {
          const page = pages[pageNum - 1] // pdf-lib uses 0-based indexing
          const { height: pageHeight } = page.getSize()

          for (const deletion of pageDeletions) {
            try {
              // Draw white rectangle to cover deleted text
              maskOriginalText(page, {
                x: deletion.x,
                y: pageHeight - deletion.y - deletion.height,
                width: deletion.width,
                height: deletion.height,
              })
            } catch (deletionError) {
              console.warn(`Failed to add text deletion for page ${pageNum}:`, deletionError)
            }
          }
        }
      }

      // Serialize the PDF
      const editedPdfBytes = await pdfDoc.save()

      // Download the edited PDF
      const blob = new Blob([editedPdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `edited_${pdfFile?.name || currentDocument?.name || "document.pdf"}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const totalAnnotations = canvasAnnotations.size
      const totalTextEdits = textEdits.size
      const totalTextReplacements = textReplacements.size
      const totalTextDeletions = textDeletions.size
      const totalExtractedChanges = Array.from(extractedTextContent.values()).reduce((count, items) => 
        count + items.filter(item => item.isDeleted || item.isEdited).length, 0
      )

      toast({
        title: "Success",
        description: `PDF downloaded with all changes! (${totalAnnotations} annotations, ${totalTextEdits} text additions, ${totalTextReplacements} replacements, ${totalTextDeletions} deletions, ${totalExtractedChanges} text edits)`,
      })

    } catch (error) {
      console.error("Failed to create edited PDF:", error)
      toast({
        title: "Error", 
        description: "Failed to create edited PDF. Downloading original instead.",
        variant: "destructive",
      })
      // Fallback to original PDF
      await downloadOriginalPDF()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p>Loading editor...</p>
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
              {user && (
                <Link href="/dashboard">
                  <Button variant="outline">Back to Dashboard</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Toolbar */}
        <Card className="w-64 m-4 p-4 h-fit">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Upload PDF</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
              <Button
                variant="outline" 
                className="w-full mt-2"
                onClick={() => {
                  // Create a simple test PDF URL (public domain sample)
                  setPdfUrl('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf')
                  setPdfFile(null)
                  setCurrentDocument(null)
                  setCurrentPage(1)
                  setError("")
                  setCanvasAnnotations(new Map())
                  setHasUnsavedChanges(false)
                  toast({
                    title: "Test PDF loaded",
                    description: "Loading sample PDF for testing",
                  })
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Load Test PDF
              </Button>
            </div>

            <Separator />

            {/* Download Actions */}
            <div>
              <Label className="text-sm font-medium">Actions</Label>
              <div className="space-y-2 mt-2">
                <Button 
                  variant={hasUnsavedChanges ? "default" : "outline"} 
                  size="sm" 
                  className="w-full" 
                  onClick={saveDocument}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {hasUnsavedChanges ? "Save Changes" : "Saved"}
                </Button>
                {(canvasAnnotations.size > 0 || textEdits.size > 0 || textReplacements.size > 0 || textDeletions.size > 0) && (
                  <Button variant="outline" size="sm" className="w-full" onClick={previewEditedPDF}>
                    <Download className="h-4 w-4 mr-2" />
                    Preview Edited PDF
                  </Button>
                )}
                <Button variant="outline" size="sm" className="w-full" onClick={downloadPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  {(canvasAnnotations.size > 0 || textEdits.size > 0 || textReplacements.size > 0 || textDeletions.size > 0) ? "Download Edited PDF" : "Download Original"}
                </Button>
                {(canvasAnnotations.size > 0 || textEdits.size > 0 || textReplacements.size > 0 || textDeletions.size > 0) && (
                  <div className="text-xs text-gray-500 text-center space-y-1 mt-2">
                    {canvasAnnotations.size > 0 && (
                      <p>Annotations on {canvasAnnotations.size} page(s)</p>
                    )}
                    {textEdits.size > 0 && (
                      <p>Text edits on {textEdits.size} page(s)</p>
                    )}
                    {textReplacements.size > 0 && (
                      <p>Text replacements on {textReplacements.size} page(s)</p>
                    )}
                    {textDeletions.size > 0 && (
                      <p>Text deletions on {textDeletions.size} page(s)</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-medium">Tools</Label>
              {currentTool.type === "text" && (
                <div className="text-xs text-gray-600 mb-2 p-2 bg-blue-50 rounded border-2 border-blue-200">
                  📝 <strong>Text Mode Active!</strong><br/>
                  <div className="mt-2 space-y-2">
                    <div className="bg-yellow-100 p-2 rounded text-xs border-l-4 border-yellow-400">
                      ✨ <strong>Existing text is now selectable!</strong><br/>
                      Hover over text in the PDF to see it highlight.
                </div>
                    <div className="flex space-x-1">
                      <button
                        className={`px-2 py-1 rounded text-xs font-medium ${textInteractionMode === "select" ? "bg-blue-500 text-white" : "bg-gray-200 hover:bg-gray-300"}`}
                        onClick={() => setTextInteractionMode("select")}
                      >
                        ✏️ Edit/Replace
                      </button>
                      <button
                        className={`px-2 py-1 rounded text-xs font-medium ${textInteractionMode === "delete" ? "bg-red-500 text-white" : "bg-gray-200 hover:bg-gray-300"}`}
                        onClick={() => setTextInteractionMode("delete")}
                      >
                        🗑️ Delete
                      </button>
              </div>
                    <div className="text-xs mt-1 p-1 bg-white rounded">
                      {textInteractionMode === "select" && "💡 Select any text in the PDF to replace it with new text"}
                      {textInteractionMode === "delete" && "💡 Select any text in the PDF to delete it permanently"}
            </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  variant={currentTool.type === "pen" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentTool({ ...currentTool, type: "pen" })}
                >
                  <Pen className="h-4 w-4" />
                </Button>
                <Button
                  variant={currentTool.type === "highlighter" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentTool({ ...currentTool, type: "highlighter" })}
                >
                  <Highlighter className="h-4 w-4" />
                </Button>
                <Button
                  variant={currentTool.type === "text" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentTool({ ...currentTool, type: "text" })}
                  title="Text Tool - Add, edit, replace, or delete text in PDF"
                >
                  <Type className="h-4 w-4" />
                </Button>
                <Button
                  variant={currentTool.type === "rectangle" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentTool({ ...currentTool, type: "rectangle" })}
                >
                  <Square className="h-4 w-4" />
                </Button>
                <Button
                  variant={currentTool.type === "circle" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentTool({ ...currentTool, type: "circle" })}
                >
                  <Circle className="h-4 w-4" />
                </Button>
                <Button
                  variant={currentTool.type === "eraser" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentTool({ ...currentTool, type: "eraser" })}
                >
                  <Eraser className="h-4 w-4" />
                </Button>
              </div>
              </div>

                <div>
              <Label className="text-sm font-medium">Color</Label>
              <Input
                type="color"
                value={currentTool.color}
                onChange={(e) => setCurrentTool({ ...currentTool, color: e.target.value })}
                className="w-full h-10 mt-2"
              />
              <div className="grid grid-cols-3 gap-1 mt-2">
                {[
                  "#FF0000", // Red
                  "#0000FF", // Blue
                  "#00AA00", // Green
                  "#FF8800", // Orange
                  "#8800FF", // Purple
                  "#FF0088", // Pink
                  "#000000", // Black
                  "#FFFF00", // Yellow
                  "#FFFFFF", // White (100% opacity)
                ].map((color) => (
                      <button
                        key={color}
                    className={`w-8 h-8 rounded border-2 ${
                      currentTool.color === color 
                        ? "border-gray-800" 
                        : color === "#FFFFFF" 
                          ? "border-gray-500" // Special border for white
                          : "border-gray-300"
                    }`}
                    style={{ 
                      backgroundColor: color,
                      // Add a subtle inner shadow for white to make it more visible
                      boxShadow: color === "#FFFFFF" ? "inset 0 0 0 1px rgba(0,0,0,0.1)" : "none"
                    }}
                    onClick={() => setCurrentTool({ ...currentTool, color })}
                    title={`Use ${color === "#FFFFFF" ? "White (100% opacity)" : color}`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                <Label className="text-sm font-medium">Size: {currentTool.size}px</Label>
                <Input
                  type="range"
                  min="2"
                  max="30"
                  value={currentTool.size}
                  onChange={(e) => setCurrentTool({ ...currentTool, size: parseInt(e.target.value) })}
                  className="w-full mt-2"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Fine</span>
                  <span>Bold</span>
                  <span>Extra Bold</span>
                  </div>
                </div>

                {/* Fill Options for shapes */}
                {(currentTool.type === "rectangle" || currentTool.type === "circle") && (
                  <div>
                    <Label className="text-sm font-medium">Fill Shape?</Label>
                    <div className="flex items-center space-x-2 mt-2">
                      <Switch
                        checked={currentTool.fill}
                        onCheckedChange={(value) => setCurrentTool({ ...currentTool, fill: value })}
                      />
                      <span className="text-sm">Enable Fill</span>
                    </div>
                    {currentTool.fill && (
                      <div className="mt-2">
                        <Label className="text-sm font-medium">Fill Color</Label>
                        <Input
                          type="color"
                          value={currentTool.fillColor}
                          onChange={(e) => setCurrentTool({ ...currentTool, fillColor: e.target.value })}
                          className="w-full h-10 mt-2"
                        />
                      </div>
                    )}
                )}

            {/* Text Tool Mode Selection */}
            {currentTool.type === "text" && (
              <div>
                <Label className="text-sm font-medium">Text Mode</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Button
                    variant={textInteractionMode === "edit" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTextInteractionMode("edit")}
                    className="text-xs"
                  >
                    ✏️ Edit Text
                  </Button>
                  <Button
                    variant={textInteractionMode === "delete" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTextInteractionMode("delete")}
                    className="text-xs"
                  >
                    🗑️ Delete Text
                  </Button>
            </div>
                <p className="text-xs text-gray-500 mt-1">
                  {textInteractionMode === "edit" ? "Click blue boxes to edit text" : "Click blue boxes to delete text"}
                </p>
                {isTextExtractionComplete && (
                  <p className="text-xs text-green-600 mt-1">
                    ✅ {extractedTextContent.get(currentPage)?.length || 0} text items extracted
                  </p>
                )}
              </div>
            )}

            <Separator />

              <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full" onClick={clearCanvas}>
                Clear Current Page
                </Button>
              <Button variant="outline" size="sm" className="w-full" onClick={clearCurrentPageTexts}>
                Clear Page Text
                </Button>
              <Button variant="outline" size="sm" className="w-full" onClick={clearCurrentPageReplacements}>
                Clear Text Replacements
                </Button>
              <Button variant="outline" size="sm" className="w-full" onClick={clearCurrentPageDeletions}>
                Clear Text Deletions
              </Button>
              <Button variant="outline" size="sm" className="w-full" onClick={clearAllAnnotations}>
                Clear All Pages
              </Button>
            </div>
          </div>
        </Card>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col">
          {/* PDF Controls */}
          {(pdfFile || pdfUrl) && (
            <Card className="m-4 p-4">
              <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                  <span className="text-sm">
                  Page {currentPage} of {numPages}
                </span>
                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage >= numPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={handleZoomOut}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm min-w-[60px] text-center">{Math.round(scale * 100)}%</span>
                  <Button variant="outline" size="sm" onClick={handleZoomIn}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRotate}>
                    <RotateCw className="h-4 w-4" />
                  </Button>
            </div>
              </div>
            </Card>
          )}

          {/* PDF Viewer */}
          <div className="flex-1 overflow-auto p-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            {!pdfFile && !pdfUrl ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FileText className="h-24 w-24 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No PDF loaded</h3>
                  <p className="text-gray-500">Upload a PDF file to start editing</p>
                </div>
              </div>
            ) : isClient ? (
              <div className="relative flex justify-center">
                <div 
                  className={`relative ${currentTool.type === "text" ? `text-tool-active ${textInteractionMode}-mode` : ""}`}
                  onClick={handleTextClick}
                  onMouseMove={handleTextMouseMove}
                  onMouseUp={handleTextMouseUp}
                  onMouseLeave={handleTextMouseUp}
                >
                  <Document
                    file={pdfFile || pdfUrl || undefined}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    onLoadProgress={({ loaded, total }) => {
                      console.log(`PDF loading progress: ${loaded}/${total} (${Math.round(loaded / total * 100)}%)`)
                    }}
                    onItemClick={({ pageNumber }) => {
                      console.log('Clicked on page:', pageNumber)
                    }}
                    options={{
                      cMapUrl: 'https://unpkg.com/pdfjs-dist@2.16.105/cmaps/',
                      cMapPacked: true,
                      standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@2.16.105/standard_fonts/',
                    }}
                    loading={
                      <div className="flex items-center justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-2">Loading PDF...</span>
                      </div>
                    }
                  >
                    <Page
                      pageNumber={currentPage}
                      scale={scale}
                      rotate={rotation}
                      renderTextLayer={true}
                      renderAnnotationLayer={false}
                      onLoadSuccess={() => {
                        // Setup text selection when page loads
                        setTimeout(() => {
                          setupTextSelection()
                        }, 200)
                      }}
                    />
                  </Document>
                  <canvas
                    ref={canvasRef}
                    className={`absolute top-0 left-0 ${
                      currentTool.type === "eraser" ? "cursor-cell" :
                      currentTool.type === "text" ? "cursor-text" :
                      currentTool.type === "rectangle" || currentTool.type === "circle" ? "cursor-crosshair" :
                      "cursor-crosshair"
                    }`}
                    style={{
                      width: `${612 * scale}px`,
                      height: `${792 * scale}px`,
                    }}
                    width={612 * scale}
                    height={792 * scale}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={() => setIsDrawing(false)}
                  />
                  
                  {/* Text edit overlays */}
                  {textEdits.get(currentPage)?.map((textEdit) => (
                    <div
                      key={textEdit.id}
                      className={`absolute border-2 rounded p-1 select-none transition-all duration-200 shadow-lg ${
                        draggedTextId === textEdit.id 
                          ? 'border-blue-600 bg-white cursor-grabbing' 
                          : 'border-blue-500 bg-white cursor-grab hover:border-blue-600 hover:shadow-xl'
                      }`}
                    style={{
                        left: textEdit.x * scale,
                        top: textEdit.y * scale,
                        width: textEdit.width * scale,
                        minHeight: textEdit.height * scale,
                        fontSize: textEdit.fontSize * scale,
                        color: textEdit.fontColor,
                        zIndex: draggedTextId === textEdit.id ? 30 : 18, // Higher z-index
                        backgroundColor: '#ffffff', // Always white background
                        opacity: 1, // Fully opaque
                        boxShadow: draggedTextId === textEdit.id ? '0 4px 12px rgba(0,0,0,0.25)' : '0 2px 8px rgba(0,0,0,0.15)',
                      }}
                      onMouseDown={(e) => handleTextMouseDown(e, textEdit)}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        if (!draggedTextId) {
                          setActiveTextEdit(textEdit)
                        }
                      }}
                      title="Drag to move, double-click to edit"
                    >
                      {textEdit.newText}
                      <button
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 z-30"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteTextEdit(textEdit.id)
                        }}
                        title="Delete text"
                      >
                        ×
                      </button>
                      {/* Drag handle indicator */}
                      {draggedTextId !== textEdit.id && (
                        <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-400 rounded-full opacity-60 hover:opacity-100" />
                      )}
                    </div>
                  ))}
                  
                  {/* Text replacement overlays */}
                  {textReplacements.get(currentPage)?.map((replacement) => (
                    <div
                      key={replacement.id}
                      className="absolute border-2 border-orange-500 rounded p-1 select-none shadow-lg"
                      style={{
                        left: (replacement.x - 1) * scale, // Extra padding for better coverage
                        top: (replacement.y - 1) * scale,
                        width: (replacement.width + 2) * scale, // Extra width for better coverage
                        minHeight: (replacement.height + 2) * scale, // Extra height for better coverage
                        fontSize: replacement.fontSize * scale,
                        color: replacement.fontColor,
                        backgroundColor: '#ffffff', // Always white background for complete coverage
                        zIndex: 22, // Higher z-index to ensure it's above everything
                        opacity: 1, // Fully opaque
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)', // Better shadow
                      }}
                      title={`Replacement: "${replacement.originalText}" → "${replacement.newText}"`}
                    >
                      {/* Background layer for complete coverage */}
                      <div 
                        className="absolute inset-0" 
                        style={{ 
                          backgroundColor: '#ffffff',
                          width: '100%',
                          height: '100%',
                          borderRadius: '2px',
                        }}
                      />
                      {replacement.newText}
                      <button
                        className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-orange-600 z-30"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteTextReplacement(replacement.id)
                        }}
                        title="Delete replacement"
                      >
                        ×
                      </button>
                      {/* Replacement indicator */}
                      <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-orange-400 rounded-full opacity-80" />
                </div>
                  ))}
                  
                  {/* Text deletion overlays */}
                  {textDeletions.get(currentPage)?.map((deletion) => (
                    <div
                      key={deletion.id}
                      className="absolute border-2 border-red-500 select-none shadow-lg"
                      style={{
                        left: (deletion.x - 2) * scale, // Extra padding for better coverage
                        top: (deletion.y - 2) * scale,
                        width: (deletion.width + 4) * scale, // Extra width for better coverage
                        height: (deletion.height + 4) * scale, // Extra height for better coverage
                        zIndex: 20, // Higher z-index to ensure it's above everything
                        backgroundColor: '#ffffff', // Solid white background
                        opacity: 1, // Fully opaque
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)', // Better shadow
                      }}
                      title={`Deleted: "${deletion.deletedText}"`}
                    >
                      {/* Triple-layer background for complete coverage */}
                      <div 
                        className="absolute inset-0" 
                        style={{ 
                          backgroundColor: '#ffffff',
                          width: '100%',
                          height: '100%',
                          borderRadius: '2px',
                        }}
                      />
                      <div 
                        className="absolute inset-0" 
                        style={{ 
                          backgroundColor: '#ffffff',
                          width: '100%',
                          height: '100%',
                          opacity: 1,
                        }}
                      />
                      <div 
                        className="absolute inset-0" 
                        style={{ 
                          backgroundColor: '#ffffff',
                          width: '100%',
                          height: '100%',
                          opacity: 1,
                        }}
                      />
                      {/* Deletion indicator text */}
                      <div className="relative text-red-700 text-xs font-bold bg-red-100 px-3 py-1 rounded shadow-sm border border-red-300 z-10">
                        🗑️ DELETED
                      </div>
                      <button
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 z-30 shadow-md"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteTextDeletion(deletion.id)
                        }}
                        title="Undo deletion"
                      >
                        ↶
                      </button>
                      {/* Corner indicator */}
                      <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-red-400 rounded-full opacity-90 shadow-sm" />
                    </div>
                  ))}
                  
                  {/* Extracted text content overlays */}
                  {isTextExtractionComplete && currentTool.type === "text" && extractedTextContent.get(currentPage)?.map((textItem) => (
                    <div
                      key={textItem.id}
                      className={`absolute border-2 rounded cursor-pointer transition-all duration-200 shadow-sm ${
                        textItem.isDeleted 
                          ? 'border-red-600 bg-white shadow-lg' 
                          : textItem.isEdited 
                            ? 'border-green-600 bg-white shadow-lg' 
                            : textInteractionMode === "delete" 
                              ? 'border-red-400 bg-red-100 bg-opacity-80 hover:border-red-600 hover:bg-red-200' 
                              : 'border-blue-400 bg-blue-100 bg-opacity-80 hover:border-blue-600 hover:bg-blue-200'
                      }`}
                      style={{
                        left: (textItem.x - 1) * scale, // Extra padding for better coverage
                        top: (textItem.y - 1) * scale,
                        width: Math.max((textItem.width + 2) * scale, 22), // Extra width for better coverage
                        height: Math.max((textItem.height + 2) * scale, 18), // Extra height for better coverage
                        fontSize: Math.max((textItem.fontSize * scale * 0.8), 10) + 'px',
                        zIndex: textItem.isDeleted || textItem.isEdited ? 25 : 10, // Higher z-index for modified text
                        opacity: 1, // Always fully opaque
                        minHeight: '18px', // Ensure clickable area
                        display: 'flex',
                        alignItems: 'center',
                        padding: '2px 4px',
                        backgroundColor: textItem.isDeleted || textItem.isEdited ? '#ffffff' : undefined, // White background for modifications
                        boxShadow: textItem.isDeleted || textItem.isEdited ? '0 2px 8px rgba(0,0,0,0.15)' : undefined,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        console.log("Clicked text item:", textItem.text)
                        handleExtractedTextClick(textItem)
                      }}
                      title={textItem.isDeleted ? `Deleted: "${textItem.text}"` : textItem.isEdited ? `Edited: "${textItem.text}" → "${textItem.editedText}"` : `Click to ${textInteractionMode === "delete" ? "delete" : "edit"}: "${textItem.text}"`}
                    >
                      {/* Triple-layer background for deleted text - maximum coverage */}
                      {textItem.isDeleted && (
                        <>
                          <div 
                            className="absolute inset-0 bg-white"
                            style={{ 
                              width: '100%',
                              height: '100%',
                              backgroundColor: '#ffffff',
                              opacity: 1,
                              borderRadius: '3px',
                            }}
                          />
                          <div 
                            className="absolute inset-0 bg-white"
                            style={{ 
                              width: '100%',
                              height: '100%',
                              backgroundColor: '#ffffff',
                              opacity: 1,
                            }}
                          />
                          <div 
                            className="absolute inset-0 bg-white"
                            style={{ 
                              width: '100%',
                              height: '100%',
                              backgroundColor: '#ffffff',
                              opacity: 1,
                            }}
                          />
                        </>
                      )}
                      
                      {textItem.isDeleted ? (
                        <div className="relative text-red-800 text-xs font-bold text-center w-full bg-red-50 py-1 px-2 rounded border border-red-200 z-10">
                          🗑️ DELETED
              </div>
            ) : (
                        <div className="text-xs break-words w-full text-gray-800 font-medium">
                          {textItem.isEdited ? textItem.editedText : textItem.text}
                        </div>
                      )}
                      
                      {/* Action buttons */}
                      {(textItem.isDeleted || textItem.isEdited) && (
                        <button
                          className="absolute -top-3 -right-3 w-7 h-7 bg-blue-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-blue-600 z-30 shadow-md border-2 border-white"
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            restoreExtractedTextItem(textItem.id)
                          }}
                          title="Restore original text"
                        >
                          ↶
                        </button>
                      )}
                      
                      {/* Visual indicator for interaction mode */}
                      {!textItem.isDeleted && !textItem.isEdited && (
                        <div className={`absolute -top-1 -left-1 w-3 h-3 rounded-full ${
                          textInteractionMode === "delete" ? 'bg-red-400' : 'bg-blue-400'
                        } opacity-70`} />
                      )}
                    </div>
                  ))}
                  
                  {/* Text tool active overlay */}
                  {currentTool.type === "text" && (
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-1">
                      <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium border-2 border-blue-400">
                        📝 Text Tool Active - {textInteractionMode === "delete" ? "🗑️ Delete Mode" : "✏️ Edit Mode"}
                        <div className="text-xs mt-1 opacity-90">
                          {!isTextExtractionComplete ? (
                            "⏳ Extracting text content..."
                          ) : (
                            textInteractionMode === "delete" ? "Click on blue text boxes to delete them" : "Click on blue text boxes to edit them"
                          )}
                        </div>
                        {isTextExtractionComplete && (
                          <div className="text-xs mt-1 opacity-75">
                            ✅ Text extraction complete - {extractedTextContent.get(currentPage)?.length || 0} items on this page
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Text selection replacement dialog */}
                  {selectedTextElement && (
                    <div
                      className="absolute border-2 border-orange-500 bg-white rounded p-2 shadow-lg"
                      style={{
                        left: selectedTextElement.x * scale,
                        top: (selectedTextElement.y + selectedTextElement.height + 10) * scale,
                        width: Math.max(selectedTextElement.width * scale, 250),
                        zIndex: 25,
                      }}
                    >
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-700">
                          Replace: "{selectedTextElement.text}"
                        </div>
                        <Input
                          type="text"
                          placeholder="Enter replacement text..."
                          className="text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const newText = (e.target as HTMLInputElement).value
                              createTextReplacement(selectedTextElement, newText)
                            } else if (e.key === 'Escape') {
                              setSelectedTextElement(null)
                            }
                          }}
                        />
                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            onClick={() => {
                              const input = document.querySelector('input[placeholder="Enter replacement text..."]') as HTMLInputElement
                              if (input) {
                                createTextReplacement(selectedTextElement, input.value)
                              }
                            }}
                            className="text-xs px-2"
                          >
                            Replace
                  </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedTextElement(null)}
                            className="text-xs px-2"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
              </div>
            )}
                  
                  {/* Active text edit input */}
                  {activeTextEdit && (
                    <div
                      className="absolute border-2 border-blue-500 bg-white rounded p-2 shadow-lg pointer-events-auto"
                      style={{
                        left: activeTextEdit.x * scale,
                        top: activeTextEdit.y * scale,
                        width: Math.max(activeTextEdit.width * scale, 200),
                        zIndex: 1000,
                      }}
                    >
                      <div className="space-y-2">
                        <Input
                          type="text"
                          value={activeTextEdit.newText}
                          onChange={(e) => setActiveTextEdit({ ...activeTextEdit, newText: e.target.value })}
                          placeholder="Enter text..."
                          className="text-sm"
                          autoFocus
                        />
                        <div className="flex space-x-1">
                          <Input
                            type="number"
                            value={activeTextEdit.fontSize}
                            onChange={(e) => setActiveTextEdit({ ...activeTextEdit, fontSize: parseInt(e.target.value) || 16 })}
                            className="w-16 text-xs"
                            min="8"
                            max="72"
                          />
                          <Input
                            type="color"
                            value={activeTextEdit.fontColor}
                            onChange={(e) => setActiveTextEdit({ ...activeTextEdit, fontColor: e.target.value })}
                            className="w-12 h-8"
                          />
                          <Button
                            size="sm"
                            onClick={() => saveTextEdit(activeTextEdit)}
                            className="text-xs px-2"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActiveTextEdit(null)}
                            className="text-xs px-2"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Extracted text edit interface */}
                  {selectedTextItem && textInteractionMode === "edit" && (
                    <div
                      className="absolute border-2 border-green-500 bg-white rounded p-2 shadow-lg pointer-events-auto"
                      style={{
                        left: selectedTextItem.x * scale,
                        top: (selectedTextItem.y + selectedTextItem.height + 10) * scale,
                        width: Math.max(selectedTextItem.width * scale, 250),
                        zIndex: 1000,
                      }}
                    >
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-700">
                          Edit Text: "{selectedTextItem.text}"
                        </div>
                        <Input
                          type="text"
                          defaultValue={selectedTextItem.isEdited ? selectedTextItem.editedText : selectedTextItem.text}
                          placeholder="Enter new text..."
                          className="text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const newText = (e.target as HTMLInputElement).value
                              if (newText.trim()) {
                                editExtractedTextItem(selectedTextItem.id, newText)
                              }
                            } else if (e.key === 'Escape') {
                              setSelectedTextItem(null)
                            }
                          }}
                        />
                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            onClick={() => {
                              const input = document.querySelector('input[placeholder="Enter new text..."]') as HTMLInputElement
                              if (input && input.value.trim()) {
                                editExtractedTextItem(selectedTextItem.id, input.value)
                              }
                            }}
                            className="text-xs px-2"
                          >
                            Save Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedTextItem(null)}
                            className="text-xs px-2"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p>Loading PDF viewer...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
