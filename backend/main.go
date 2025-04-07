package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"einvoice-app/models"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skip2/go-qrcode"
	"github.com/xuri/excelize/v2"
)

// Database connection parameters
const (
	dbHost     = "localhost"
	dbPort     = 5432
	dbUser     = "postgres"
	dbPassword = "root"
	dbName     = "einvoice"
	jwtSecret  = "einvoice-app-secret-key" // In production, use environment variable
)

// Global database connection pool
var dbPool *pgxpool.Pool

// TokenClaims represents JWT claims
type TokenClaims struct {
	UserID int `json:"user_id"`
	jwt.RegisteredClaims
}

// LoginRequest represents the login request body
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// RegisterRequest represents the register request body
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

func main() {
	// Initialize database connection
	initDB()
	defer dbPool.Close()

	// Create tables if they don't exist
	createTables()

	// Initialize Gin router
	router := gin.Default()

	// Configure CORS - Make it more permissive for debugging
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept"},
		ExposeHeaders:    []string{"Content-Length", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Public routes - MUST be defined BEFORE the authMiddleware
	router.POST("/api/register", handleRegister)
	router.POST("/api/login", handleLogin)

	// Protected routes group
	auth := router.Group("/api")
	auth.Use(authMiddleware())
	{
		auth.POST("/generate-invoice", handleGenerateInvoice)
		auth.POST("/upload-excel", handleUploadExcel)
		auth.GET("/export-invoices", handleExportInvoices)
		auth.GET("/invoices", handleGetInvoices)
		auth.GET("/qr/:id", handleGetQRCode)
	}

	// Start server
	log.Println("Starting server on :8080")
	if err := router.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// initDB establishes a connection to the PostgreSQL database
func initDB() {
	connStr := fmt.Sprintf("postgres://%s:%s@%s:%d/%s", dbUser, dbPassword, dbHost, dbPort, dbName)
	
	config, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		log.Fatalf("Unable to parse connection string: %v", err)
	}
	
	// Set connection pool parameters
	config.MaxConns = 10
	
	dbPool, err = pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	
	// Verify connection
	if err := dbPool.Ping(context.Background()); err != nil {
		log.Fatalf("Unable to ping database: %v", err)
	}
	
	log.Println("Connected to database")
}

// createTables creates the necessary tables if they don't exist
func createTables() {
	// Create users table
	_, err := dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			email VARCHAR(255) UNIQUE NOT NULL,
			password VARCHAR(255) NOT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatalf("Failed to create users table: %v", err)
	}

	// Create invoices table
	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS invoices (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id),
			seller_gstin VARCHAR(15) NOT NULL,
			invoice_no VARCHAR(50) UNIQUE NOT NULL,
			invoice_json JSONB NOT NULL,
			qr_code BYTEA,
			created_at TIMESTAMP NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatalf("Failed to create invoices table: %v", err)
	}

	log.Println("Database tables created")
}

// authMiddleware validates JWT tokens for protected routes
func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || len(authHeader) < 8 || authHeader[:7] != "Bearer " {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing or invalid authorization header"})
			c.Abort()
			return
		}

		tokenString := authHeader[7:]
		claims := &TokenClaims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// Set user ID in context
		c.Set("userID", claims.UserID)
		c.Next()
	}
}

// handleRegister handles user registration
func handleRegister(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if email already exists
	var count int
	err := dbPool.QueryRow(context.Background(), "SELECT COUNT(*) FROM users WHERE email = $1", req.Email).Scan(&count)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email already registered"})
		return
	}

	// Create new user
	user, err := models.NewUser(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Insert user into database
	var userID int
	err = dbPool.QueryRow(context.Background(),
		"INSERT INTO users (email, password, created_at) VALUES ($1, $2, $3) RETURNING id",
		user.Email, user.Password, user.CreatedAt).Scan(&userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "User registered successfully"})
}

// handleLogin handles user login
func handleLogin(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Retrieve user from database
	var user models.User
	err := dbPool.QueryRow(context.Background(),
		"SELECT id, email, password, created_at FROM users WHERE email = $1",
		req.Email).Scan(&user.ID, &user.Email, &user.Password, &user.CreatedAt)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Verify password
	if !user.CheckPassword(req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Generate JWT token
	claims := TokenClaims{
		UserID: user.ID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"user": gin.H{
			"id":    user.ID,
			"email": user.Email,
		},
	})
}

// handleGenerateInvoice handles the generation of a new invoice
func handleGenerateInvoice(c *gin.Context) {
	userID := c.GetInt("userID")

	// Parse invoice data
	var invoices []models.EInvoice
	if err := c.ShouldBindJSON(&invoices); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(invoices) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No invoice data provided"})
		return
	}

	results := make([]gin.H, 0, len(invoices))

	// Process each invoice
	for _, invoice := range invoices {
		// Validate invoice data
		if err := invoice.Validate(); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Calculate totals
		invoice.CalculateTotals()

		// Create QR code (invoice_no + TotInvVal)
		qrContent := fmt.Sprintf("%s:%.2f", invoice.DocDtls.No, invoice.ValDtls.TotInvVal)
		qrCode, err := qrcode.Encode(qrContent, qrcode.Medium, 256)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate QR code"})
			return
		}

		// Convert invoice to JSON
		invoiceJSON, err := json.Marshal(invoice)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize invoice"})
			return
		}

		// Store in database
		var invoiceID int
		err = dbPool.QueryRow(context.Background(),
			`INSERT INTO invoices (user_id, seller_gstin, invoice_no, invoice_json, qr_code, created_at)
			VALUES ($1, $2, $3, $4, $5, NOW())
			RETURNING id`,
			userID, invoice.SellerDtls.Gstin, invoice.DocDtls.No, invoiceJSON, qrCode).Scan(&invoiceID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store invoice"})
			return
		}

		results = append(results, gin.H{
			"id":         invoiceID,
			"invoice_no": invoice.DocDtls.No,
			"qr_url":     fmt.Sprintf("/api/qr/%d", invoiceID),
		})
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Invoice(s) generated successfully",
		"invoices": results,
	})
}

// handleUploadExcel handles the upload and processing of an Excel file
func handleUploadExcel(c *gin.Context) {
	userID := c.GetInt("userID")

	// Get uploaded file
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// Check file type
	if file.Header.Get("Content-Type") != "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only Excel files (.xlsx) are supported"})
		return
	}

	// Open file
	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
		return
	}
	defer src.Close()

	// Create temp file
	tempFile, err := os.CreateTemp("", "upload-*.xlsx")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create temp file"})
		return
	}
	defer os.Remove(tempFile.Name())
	defer tempFile.Close()

	// Copy to temp file
	fileBytes := make([]byte, file.Size)
	if _, err = src.Read(fileBytes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}
	if _, err = tempFile.Write(fileBytes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write temp file"})
		return
	}

	// Open Excel file
	xlsx, err := excelize.OpenFile(tempFile.Name())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse Excel file"})
		return
	}
	defer xlsx.Close()

	// Get sheet names
	sheets := xlsx.GetSheetList()
	if len(sheets) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No sheets found in Excel file"})
		return
	}

	// Group items by invoice number
	invoiceMap := make(map[string]*models.EInvoice)
	itemMap := make(map[string][]models.Item)

	// Read rows from the first sheet
	rows, err := xlsx.GetRows(sheets[0])
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read sheet"})
		return
	}

	// Skip header row
	if len(rows) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Excel file does not contain enough data"})
		return
	}

	// Process data rows
	for i, row := range rows {
		if i == 0 {
			// Header row, skip
			continue
		}

		if len(row) < 12 {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Row %d does not have enough columns", i+1)})
			return
		}

		// Parse row data
		invoiceNo := row[1]
		qty, _ := strconv.ParseFloat(row[7], 64)
		unitPrice, _ := strconv.ParseFloat(row[9], 64)
		gstRate, _ := strconv.ParseFloat(row[10], 64)

		// Create or get invoice
		invoice, exists := invoiceMap[invoiceNo]
		if !exists {
			invoice = &models.EInvoice{
				Version: "1.1",
				TranDtls: models.TranDtls{
					TaxSch: "GST",
					SupTyp: "EXPWP",
					RegRev: "N",
				},
				DocDtls: models.DocDtls{
					Typ: "INV",
					No:  invoiceNo,
					Dt:  row[2], // Invoice date
				},
				SellerDtls: models.SellerDtls{
					Gstin: row[0], // Seller GSTIN
					LglNm: "SELLER COMPANY NAME",
					TrdNm: "SELLER TRADE NAME",
					Addr1: "SELLER ADDRESS LINE 1",
					Addr2: "SELLER ADDRESS LINE 2",
					Loc:   "SELLER CITY",
					Pin:   110001,
					Stcd:  "07", // Delhi
				},
				BuyerDtls: models.BuyerDtls{
					Gstin: row[3], // Buyer GSTIN
					LglNm: row[4], // Buyer legal name
					TrdNm: row[4], // Buyer trade name
					Pos:   "96",   // Place of supply
					Addr1: row[5], // Buyer address
					Addr2: "",
					Loc:   row[6], // Buyer location
					Pin:   999999,
					Stcd:  "96", // Outside India
				},
				ExpDtls: models.ExpDtls{
					ForCur:  nil,
					CntCode: nil,
				},
			}
			invoiceMap[invoiceNo] = invoice
			itemMap[invoiceNo] = []models.Item{}
		}

		// Create item
		item := models.Item{
			SlNo:       strconv.Itoa(len(itemMap[invoiceNo]) + 1),
			PrdDesc:    row[5], // Product description
			IsServc:    "N",
			HsnCd:      row[6], // HSN code
			Qty:        qty,
			Unit:       row[8], // Unit
			UnitPrice:  unitPrice,
			TotAmt:     qty * unitPrice,
			AssAmt:     qty * unitPrice,
			GstRt:      gstRate,
			IgstAmt:    (qty * unitPrice) * gstRate / 100,
			TotItemVal: (qty * unitPrice) + ((qty * unitPrice) * gstRate / 100),
		}

		// Add item to map
		itemMap[invoiceNo] = append(itemMap[invoiceNo], item)
	}

	// Process all invoices
	results := make([]gin.H, 0, len(invoiceMap))
	for invoiceNo, invoice := range invoiceMap {
		// Add items to invoice
		invoice.ItemList = itemMap[invoiceNo]

		// Calculate totals
		invoice.CalculateTotals()

		// Validate invoice
		if err := invoice.Validate(); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invoice %s: %s", invoiceNo, err.Error())})
			return
		}

		// Create QR code
		qrContent := fmt.Sprintf("%s:%.2f", invoice.DocDtls.No, invoice.ValDtls.TotInvVal)
		qrCode, err := qrcode.Encode(qrContent, qrcode.Medium, 256)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate QR code"})
			return
		}

		// Convert invoice to JSON
		invoiceJSON, err := json.Marshal(invoice)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize invoice"})
			return
		}

		// Store in database
		var invoiceID int
		err = dbPool.QueryRow(context.Background(),
			`INSERT INTO invoices (user_id, seller_gstin, invoice_no, invoice_json, qr_code, created_at)
			VALUES ($1, $2, $3, $4, $5, NOW())
			ON CONFLICT (invoice_no) DO UPDATE
			SET invoice_json = $4, qr_code = $5
			RETURNING id`,
			userID, invoice.SellerDtls.Gstin, invoice.DocDtls.No, invoiceJSON, qrCode).Scan(&invoiceID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to store invoice %s: %s", invoiceNo, err.Error())})
			return
		}

		results = append(results, gin.H{
			"id":         invoiceID,
			"invoice_no": invoice.DocDtls.No,
			"qr_url":     fmt.Sprintf("/api/qr/%d", invoiceID),
		})
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":  "Invoices imported successfully",
		"invoices": results,
	})
}

// handleExportInvoices exports user's invoices to Excel
func handleExportInvoices(c *gin.Context) {
	userID := c.GetInt("userID")

	// Fetch user's invoices
	rows, err := dbPool.Query(context.Background(),
		"SELECT invoice_json FROM invoices WHERE user_id = $1 ORDER BY created_at DESC",
		userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch invoices"})
		return
	}
	defer rows.Close()

	// Create Excel file
	f := excelize.NewFile()
	defer f.Close()

	// Set headers
	headers := []string{
		"GSTIN", "Invoice No", "Invoice Date", "Buyer GSTIN", "Buyer Name",
		"Item Description", "HSN Code", "Quantity", "Unit", "Unit Price",
		"GST Rate", "IGST Amount", "Total Amount",
	}
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue("Sheet1", cell, header)
	}

	// Process invoices
	rowIndex := 2
	for rows.Next() {
		var invoiceJSON []byte
		if err := rows.Scan(&invoiceJSON); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read invoice data"})
			return
		}

		var invoice models.EInvoice
		if err := json.Unmarshal(invoiceJSON, &invoice); err != nil {
			continue
		}

		// Add invoice items to Excel
		for _, item := range invoice.ItemList {
			f.SetCellValue("Sheet1", fmt.Sprintf("A%d", rowIndex), invoice.SellerDtls.Gstin)
			f.SetCellValue("Sheet1", fmt.Sprintf("B%d", rowIndex), invoice.DocDtls.No)
			f.SetCellValue("Sheet1", fmt.Sprintf("C%d", rowIndex), invoice.DocDtls.Dt)
			f.SetCellValue("Sheet1", fmt.Sprintf("D%d", rowIndex), invoice.BuyerDtls.Gstin)
			f.SetCellValue("Sheet1", fmt.Sprintf("E%d", rowIndex), invoice.BuyerDtls.LglNm)
			f.SetCellValue("Sheet1", fmt.Sprintf("F%d", rowIndex), item.PrdDesc)
			f.SetCellValue("Sheet1", fmt.Sprintf("G%d", rowIndex), item.HsnCd)
			f.SetCellValue("Sheet1", fmt.Sprintf("H%d", rowIndex), item.Qty)
			f.SetCellValue("Sheet1", fmt.Sprintf("I%d", rowIndex), item.Unit)
			f.SetCellValue("Sheet1", fmt.Sprintf("J%d", rowIndex), item.UnitPrice)
			f.SetCellValue("Sheet1", fmt.Sprintf("K%d", rowIndex), item.GstRt)
			f.SetCellValue("Sheet1", fmt.Sprintf("L%d", rowIndex), item.IgstAmt)
			f.SetCellValue("Sheet1", fmt.Sprintf("M%d", rowIndex), item.TotItemVal)
			rowIndex++
		}
	}

	// Generate temporary file
	tempFile, err := os.CreateTemp("", "invoices-*.xlsx")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create temporary file"})
		return
	}
	defer os.Remove(tempFile.Name())

	// Save Excel file
	if err := f.SaveAs(tempFile.Name()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate Excel file"})
		return
	}

	// Serve file
	c.FileAttachment(tempFile.Name(), "invoices.xlsx")
}

// handleGetInvoices returns all invoices for the authenticated user
func handleGetInvoices(c *gin.Context) {
	userID := c.GetInt("userID")

	// Fetch invoices
	rows, err := dbPool.Query(context.Background(),
		`SELECT id, invoice_no, seller_gstin, created_at, invoice_json
		FROM invoices WHERE user_id = $1 ORDER BY created_at DESC`,
		userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch invoices"})
		return
	}
	defer rows.Close()

	invoices := make([]gin.H, 0)
	for rows.Next() {
		var id int
		var invoiceNo, sellerGSTIN string
		var createdAt time.Time
		var invoiceJSON []byte

		if err := rows.Scan(&id, &invoiceNo, &sellerGSTIN, &createdAt, &invoiceJSON); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read invoice data"})
			return
		}

		var invoice models.EInvoice
		if err := json.Unmarshal(invoiceJSON, &invoice); err != nil {
			continue
		}

		invoices = append(invoices, gin.H{
			"id":          id,
			"invoice_no":  invoiceNo,
			"seller_gstin": sellerGSTIN,
			"buyer_name":  invoice.BuyerDtls.LglNm,
			"date":        invoice.DocDtls.Dt,
			"total_value": invoice.ValDtls.TotInvVal,
			"created_at":  createdAt,
			"qr_url":      fmt.Sprintf("/api/qr/%d", id),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"invoices": invoices,
	})
}

// handleGetQRCode returns the QR code for a specific invoice
func handleGetQRCode(c *gin.Context) {
	userID := c.GetInt("userID")
	idStr := c.Param("id")

	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invoice ID"})
		return
	}

	// Fetch QR code
	var qrCode []byte
	err = dbPool.QueryRow(context.Background(),
		"SELECT qr_code FROM invoices WHERE id = $1 AND user_id = $2",
		id, userID).Scan(&qrCode)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "QR code not found"})
		return
	}

	// Set content type and serve QR code
	c.Data(http.StatusOK, "image/png", qrCode)
} 