package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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
	"github.com/joho/godotenv"
	"github.com/skip2/go-qrcode"
	"github.com/xuri/excelize/v2"
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

// Supplier represents a supplier in the database
type Supplier struct {
	ID      int    `json:"id"`
	UserID  int    `json:"user_id"`
	Name    string `json:"name"`
	GSTIN   string `json:"gstin"`
	Address string `json:"address"`
	City    string `json:"city"`
	State   string `json:"state"`
	Pincode int    `json:"pincode"`
	Phone   string `json:"phone"`
	Email   string `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

func main() {
	// Load .env file if it exists (for local development)
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found or error loading it. Using environment variables.")
	}
	
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
	router.GET("/api/download-template", handleDownloadExcelTemplate)

	// Protected routes group
	auth := router.Group("/api")
	auth.Use(authMiddleware())
	{
		auth.POST("/generate-invoice", handleGenerateInvoice)
		auth.POST("/upload-excel", handleUploadExcel)
		auth.GET("/export-invoices", handleExportInvoices)
		auth.GET("/invoices", handleGetInvoices)
		auth.GET("/invoices/:id", handleGetInvoiceById)
		auth.PUT("/invoices/:id", handleUpdateInvoice)
		auth.DELETE("/invoices/:id", handleDeleteInvoice)
		auth.GET("/qr/:id", handleGetQRCode)
		auth.POST("/import-json", handleImportJSON)
		auth.GET("/export-json/:id", handleExportJSON)
		auth.GET("/export-all-json", handleExportAllJSON)
		auth.PUT("/invoices/:id/mark-exported", handleMarkInvoiceExported)
		auth.GET("/suppliers", handleGetSuppliers)
		auth.POST("/suppliers", handleCreateSupplier)
		auth.PUT("/suppliers/:id", handleUpdateSupplier)
		auth.DELETE("/suppliers/:id", handleDeleteSupplier)
	}

	// Get port from environment variable or use default for Render compatibility
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Default port for local development
	}
	
	// Start server
	log.Println("Starting server on port :" + port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// initDB establishes a connection to the PostgreSQL database
func initDB() {
	// Get database connection parameters from environment variables with defaults
	dbHost := getEnvWithDefault("DB_HOST", "localhost")
	dbPortStr := getEnvWithDefault("DB_PORT", "5432")
	dbUser := getEnvWithDefault("DB_USER", "postgres")
	dbPassword := getEnvWithDefault("DB_PASSWORD", "root")
	dbName := getEnvWithDefault("DB_NAME", "einvoice")
	
	// Parse port as integer
	dbPort, err := strconv.Atoi(dbPortStr)
	if err != nil {
		log.Fatalf("Invalid DB_PORT value: %v", err)
	}
	
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

// getEnvWithDefault returns the value of the environment variable or a default if not set
func getEnvWithDefault(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// Get JWT secret from environment variable or use default
func getJWTSecret() string {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		// In production, this should log a warning
		log.Println("Warning: Using default JWT secret. Set JWT_SECRET environment variable in production.")
		return "einvoice-app-secret-key"
	}
	return secret
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

	// Create invoices table with exported status
	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS invoices (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id),
			seller_gstin VARCHAR(15) NOT NULL,
			invoice_no VARCHAR(50) UNIQUE NOT NULL,
			invoice_json JSONB NOT NULL,
			qr_code BYTEA,
			exported BOOLEAN NOT NULL DEFAULT FALSE,
			exported_at TIMESTAMP,
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatalf("Failed to create invoices table: %v", err)
	}
	
	// Ensure exported columns exist
	addExportedColumnsIfNeeded()
	
	// Create companies table for sellers
	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS companies (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id),
			name VARCHAR(255) NOT NULL,
			gstin VARCHAR(15) NOT NULL,
			address TEXT NOT NULL,
			city VARCHAR(100) NOT NULL,
			state VARCHAR(100) NOT NULL,
			pincode INTEGER NOT NULL,
			phone VARCHAR(20),
			email VARCHAR(255),
			is_default BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			UNIQUE(user_id, gstin)
		)
	`)
	if err != nil {
		log.Fatalf("Failed to create companies table: %v", err)
	}
	
	// Create customers table for buyers
	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS customers (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id),
			name VARCHAR(255) NOT NULL,
			gstin VARCHAR(15),
			address TEXT,
			city VARCHAR(100),
			state VARCHAR(100),
			pincode INTEGER,
			phone VARCHAR(20),
			email VARCHAR(255),
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			UNIQUE(user_id, gstin)
		)
	`)
	if err != nil {
		log.Fatalf("Failed to create customers table: %v", err)
	}
	
	// Create items table for product/service masters
	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS items (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id),
			name VARCHAR(255) NOT NULL,
			description TEXT,
			hsn_code VARCHAR(50) NOT NULL,
			unit_price DECIMAL(12,2) NOT NULL,
			gst_rate DECIMAL(5,2) NOT NULL,
			unit VARCHAR(50) NOT NULL,
			is_service BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			UNIQUE(user_id, name, hsn_code)
		)
	`)
	if err != nil {
		log.Fatalf("Failed to create items table: %v", err)
	}

	// Create suppliers table
	_, err = dbPool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS suppliers (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id),
			name VARCHAR(255) NOT NULL,
			gstin VARCHAR(15),
			address TEXT,
			city VARCHAR(100),
			state VARCHAR(100),
			pincode INTEGER,
			phone VARCHAR(20),
			email VARCHAR(255),
			created_at TIMESTAMP NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatalf("Failed to create suppliers table: %v", err)
	}

	log.Println("Database tables created")
}

// addExportedColumnsIfNeeded adds exported and exported_at columns if they don't exist
func addExportedColumnsIfNeeded() {
	// Check if exported column exists
	var hasExportedColumn bool
	err := dbPool.QueryRow(context.Background(), `
		SELECT EXISTS (
			SELECT 1 
			FROM information_schema.columns 
			WHERE table_name = 'invoices' AND column_name = 'exported'
		)
	`).Scan(&hasExportedColumn)
	
	if err != nil {
		log.Printf("Error checking for exported column: %v", err)
		return
	}
	
	// Add the columns if they don't exist
	if !hasExportedColumn {
		log.Println("Adding exported columns to invoices table...")
		_, err := dbPool.Exec(context.Background(), `
			ALTER TABLE invoices 
			ADD COLUMN IF NOT EXISTS exported BOOLEAN NOT NULL DEFAULT FALSE,
			ADD COLUMN IF NOT EXISTS exported_at TIMESTAMP
		`)
		if err != nil {
			log.Printf("Error adding exported columns: %v", err)
		} else {
			log.Println("Exported columns added successfully")
		}
	}
	
	// Check if updated_at column exists
	var hasUpdatedAtColumn bool
	err = dbPool.QueryRow(context.Background(), `
		SELECT EXISTS (
			SELECT 1 
			FROM information_schema.columns 
			WHERE table_name = 'invoices' AND column_name = 'updated_at'
		)
	`).Scan(&hasUpdatedAtColumn)
	
	if err != nil {
		log.Printf("Error checking for updated_at column: %v", err)
		return
	}
	
	// Add the updated_at column if it doesn't exist
	if !hasUpdatedAtColumn {
		log.Println("Adding updated_at column to invoices table...")
		_, err := dbPool.Exec(context.Background(), `
			ALTER TABLE invoices 
			ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()
		`)
		if err != nil {
			log.Printf("Error adding updated_at column: %v", err)
		} else {
			log.Println("Updated_at column added successfully")
		}
	}
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
			return []byte(getJWTSecret()), nil
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
	tokenString, err := token.SignedString([]byte(getJWTSecret()))
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

	// First check if the user has any invoices
	var count int
	err := dbPool.QueryRow(context.Background(), 
		"SELECT COUNT(*) FROM invoices WHERE user_id = $1", 
		userID).Scan(&count)
	
	if err != nil {
		log.Printf("Error checking invoice count: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// If no invoices, return empty array
	if count == 0 {
		c.JSON(http.StatusOK, gin.H{
			"invoices": []gin.H{},
		})
		return
	}

	// Fetch invoices
	rows, err := dbPool.Query(context.Background(),
		`SELECT id, invoice_no, seller_gstin, created_at, invoice_json, exported, exported_at
		FROM invoices WHERE user_id = $1 ORDER BY created_at DESC`,
		userID)
	if err != nil {
		log.Printf("Error fetching invoices: %v", err)
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
		var exported bool
		var exportedAt *time.Time

		if err := rows.Scan(&id, &invoiceNo, &sellerGSTIN, &createdAt, &invoiceJSON, &exported, &exportedAt); err != nil {
			log.Printf("Error scanning invoice row: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read invoice data"})
			return
		}

		// Create basic invoice data without unmarshaling JSON
		invoiceMap := gin.H{
			"id":           id,
			"invoice_no":   invoiceNo,
			"seller_gstin": sellerGSTIN,
			"created_at":   createdAt,
			"qr_url":       fmt.Sprintf("/api/qr/%d", id),
			"exported":     exported,
		}
		
		if exportedAt != nil {
			invoiceMap["exported_at"] = *exportedAt
		}

		// Try to extract buyer and invoice details from JSON
		var invoiceData models.EInvoice
		if err := json.Unmarshal(invoiceJSON, &invoiceData); err != nil {
			log.Printf("Error unmarshaling invoice JSON: %v", err)
			// Add placeholder values for fields that would come from JSON
			invoiceMap["buyer_name"] = "Unknown"
			invoiceMap["date"] = ""
			invoiceMap["total_value"] = 0
		} else {
			// Successfully parsed JSON, add the data
			invoiceMap["buyer_name"] = invoiceData.BuyerDtls.LglNm
			invoiceMap["date"] = invoiceData.DocDtls.Dt
			invoiceMap["total_value"] = invoiceData.ValDtls.TotInvVal
		}
		
		invoices = append(invoices, invoiceMap)
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

// handleImportJSON imports an Indian GST-compliant JSON invoice
func handleImportJSON(c *gin.Context) {
	userID := c.GetInt("userID")

	// Try parsing as a single invoice first
	var singleInvoice models.EInvoice
	if err := c.ShouldBindJSON(&singleInvoice); err != nil {
		// If that fails, try parsing as an array
		var invoiceArray []models.EInvoice
		if err := c.BindJSON(&invoiceArray); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON format: " + err.Error()})
			return
		}

		// Check if array is empty
		if len(invoiceArray) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No invoice data provided"})
			return
		}

		// Process all invoices in the array
		results := make([]gin.H, 0, len(invoiceArray))
		for _, invoice := range invoiceArray {
			// Validate invoice data
			if err := invoice.Validate(); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invoice data: " + err.Error()})
				return
			}

			// Calculate totals
			invoice.CalculateTotals()

			// Create QR code
			qrContent := fmt.Sprintf("%s:%.2f", invoice.DocDtls.No, invoice.ValDtls.TotInvVal)
			qrCode, err := qrcode.Encode(qrContent, qrcode.Medium, 256)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate QR code"})
				return
			}

			// Serialize the invoice
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
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store invoice: " + err.Error()})
				return
			}

			results = append(results, gin.H{
				"id":         invoiceID,
				"invoice_no": invoice.DocDtls.No,
				"qr_url":     fmt.Sprintf("/api/qr/%d", invoiceID),
			})
		}

		c.JSON(http.StatusCreated, gin.H{
			"message": fmt.Sprintf("%d invoice(s) imported successfully", len(invoiceArray)),
			"invoices": results,
		})
		return
	}

	// Process single invoice
	// Validate invoice data
	if err := singleInvoice.Validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invoice data: " + err.Error()})
		return
	}

	// Calculate totals
	singleInvoice.CalculateTotals()

	// Create QR code
	qrContent := fmt.Sprintf("%s:%.2f", singleInvoice.DocDtls.No, singleInvoice.ValDtls.TotInvVal)
	qrCode, err := qrcode.Encode(qrContent, qrcode.Medium, 256)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate QR code"})
		return
	}

	// Serialize the invoice
	invoiceJSON, err := json.Marshal(singleInvoice)
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
		userID, singleInvoice.SellerDtls.Gstin, singleInvoice.DocDtls.No, invoiceJSON, qrCode).Scan(&invoiceID)
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store invoice: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Invoice imported successfully",
		"invoice": gin.H{
			"id":         invoiceID,
			"invoice_no": singleInvoice.DocDtls.No,
			"qr_url":     fmt.Sprintf("/api/qr/%d", invoiceID),
		},
	})
}

// validateTokenFromQuery validates a JWT token from query parameters and returns the user ID
func validateTokenFromQuery(tokenString string) (int, error) {
	// Parse the token
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// Validate the algorithm
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		
		// Return the secret key
		return []byte(getJWTSecret()), nil
	})
	
	if err != nil {
		return 0, err
	}
	
	// Validate and extract claims
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		if userID, ok := claims["user_id"].(float64); ok {
			return int(userID), nil
		}
	}
	
	return 0, errors.New("invalid token")
}

// handleExportJSON exports a specific invoice in JSON format
func handleExportJSON(c *gin.Context) {
	// Check if there's a token in the query parameters (for direct downloads)
	tokenParam := c.Query("token")
	userID := c.GetInt("userID")
	
	// If token is provided and userID is not set (meaning auth middleware didn't run)
	if tokenParam != "" && userID == 0 {
		// Validate the token and extract userID
		var err error
		userID, err = validateTokenFromQuery(tokenParam)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}
	}
	
	// Ensure we have a userID
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	invoiceID := c.Param("id")

	// Validate ID
	id, err := strconv.Atoi(invoiceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invoice ID"})
		return
	}

	// Fetch invoice
	var invoiceJSON []byte
	var invoiceNo string
	err = dbPool.QueryRow(context.Background(),
		`SELECT invoice_json, invoice_no FROM invoices WHERE id = $1 AND user_id = $2`,
		id, userID).Scan(&invoiceJSON, &invoiceNo)
	
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found: " + err.Error()})
		return
	}

	// Pretty print the JSON for better readability
	var prettyJSON bytes.Buffer
	if err := json.Indent(&prettyJSON, invoiceJSON, "", "  "); err == nil {
		invoiceJSON = prettyJSON.Bytes()
	}

	// Add necessary CORS headers for cross-origin downloads
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, Authorization")
	c.Header("Access-Control-Allow-Methods", "GET, OPTIONS")
	c.Header("Access-Control-Expose-Headers", "Content-Disposition, Content-Length, Content-Type")
	
	// Set headers for file download
	filename := fmt.Sprintf("invoice-%s.json", invoiceNo)
	c.Header("Content-Type", "application/json; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	c.Header("Content-Length", fmt.Sprintf("%d", len(invoiceJSON)))
	c.Header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
	c.Header("Cache-Control", "post-check=0, pre-check=0")
	c.Header("Pragma", "no-cache")
	
	// Ensure status is set before writing content
	c.Status(http.StatusOK)
	
	// Write the JSON data directly
	c.Writer.Write(invoiceJSON)
}

// handleExportAllJSON exports all invoices as a JSON array
func handleExportAllJSON(c *gin.Context) {
	userID := c.GetInt("userID")

	// Fetch invoices
	rows, err := dbPool.Query(context.Background(),
		`SELECT invoice_json FROM invoices WHERE user_id = $1 ORDER BY created_at DESC`,
		userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch invoices: " + err.Error()})
		return
	}
	defer rows.Close()

	// Create array of invoices
	invoices := make([]json.RawMessage, 0)
	for rows.Next() {
		var invoiceJSON []byte
		if err := rows.Scan(&invoiceJSON); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read invoice data: " + err.Error()})
			return
		}
		invoices = append(invoices, invoiceJSON)
	}

	// Return as JSON array
	result, err := json.Marshal(invoices)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize invoices: " + err.Error()})
		return
	}

	// Set headers for file download
	filename := fmt.Sprintf("all-invoices-%s.json", time.Now().Format("2006-01-02"))
	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Length", fmt.Sprintf("%d", len(result)))
	c.Header("Cache-Control", "no-cache")
	
	// Write the JSON data directly
	c.Writer.Write(result)
}

// handleMarkInvoiceExported marks an invoice as exported to GST portal
func handleMarkInvoiceExported(c *gin.Context) {
	userID := c.GetInt("userID")
	invoiceID := c.Param("id")

	// Validate ID
	id, err := strconv.Atoi(invoiceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invoice ID"})
		return
	}

	// Check if invoice exists and belongs to user
	var count int
	err = dbPool.QueryRow(context.Background(),
		"SELECT COUNT(*) FROM invoices WHERE id = $1 AND user_id = $2",
		id, userID).Scan(&count)
	
	if err != nil || count == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found or not authorized"})
		return
	}

	// Update invoice to mark as exported
	now := time.Now()
	_, err = dbPool.Exec(context.Background(),
		`UPDATE invoices SET exported = true, exported_at = $1, updated_at = $1
		WHERE id = $2 AND user_id = $3`,
		now, id, userID)
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update invoice"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Invoice marked as exported successfully",
		"invoice_id": id,
		"exported_at": now,
	})
}

// handleGetInvoiceById returns a specific invoice for the authenticated user
func handleGetInvoiceById(c *gin.Context) {
	userID := c.GetInt("userID")
	invoiceID := c.Param("id")

	// Validate ID
	id, err := strconv.Atoi(invoiceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invoice ID"})
		return
	}

	// Fetch invoice data
	var invoiceJSON []byte
	err = dbPool.QueryRow(context.Background(),
		`SELECT invoice_json FROM invoices WHERE id = $1 AND user_id = $2`,
		id, userID).Scan(&invoiceJSON)
	
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found"})
		return
	}

	// Parse invoice JSON
	var invoice models.EInvoice
	if err := json.Unmarshal(invoiceJSON, &invoice); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse invoice data"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"invoice": invoice,
		"id": id,
	})
}

// handleUpdateInvoice updates an existing invoice
func handleUpdateInvoice(c *gin.Context) {
	userID := c.GetInt("userID")
	invoiceID := c.Param("id")

	// Validate ID
	id, err := strconv.Atoi(invoiceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invoice ID"})
		return
	}

	// Parse invoice data
	var invoice models.EInvoice
	if err := c.ShouldBindJSON(&invoice); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invoice data: " + err.Error()})
		return
	}

	// Validate invoice data
	if err := invoice.Validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invoice data: " + err.Error()})
		return
	}

	// Calculate totals
	invoice.CalculateTotals()

	// Check if invoice exists and belongs to user
	var count int
	err = dbPool.QueryRow(context.Background(),
		"SELECT COUNT(*) FROM invoices WHERE id = $1 AND user_id = $2",
		id, userID).Scan(&count)
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error: " + err.Error()})
		return
	}
	
	if count == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found or not authorized"})
		return
	}

	// Update QR code
	qrContent := fmt.Sprintf("%s:%.2f", invoice.DocDtls.No, invoice.ValDtls.TotInvVal)
	qrCode, err := qrcode.Encode(qrContent, qrcode.Medium, 256)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate QR code: " + err.Error()})
		return
	}

	// Serialize invoice to JSON
	invoiceJSON, err := json.Marshal(invoice)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize invoice: " + err.Error()})
		return
	}

	// Update in database - without using updated_at
	_, err = dbPool.Exec(context.Background(),
		`UPDATE invoices 
		SET seller_gstin = $1, invoice_no = $2, invoice_json = $3, qr_code = $4
		WHERE id = $5 AND user_id = $6`,
		invoice.SellerDtls.Gstin, invoice.DocDtls.No, invoiceJSON, qrCode, id, userID)
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update invoice: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Invoice updated successfully",
		"invoice_id": id,
	})
}

// handleGetSuppliers returns all suppliers for the authenticated user
func handleGetSuppliers(c *gin.Context) {
	userID := c.GetInt("userID")

	rows, err := dbPool.Query(context.Background(), `
		SELECT id, name, gstin, address, city, state, pincode, phone, email, created_at
		FROM suppliers
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch suppliers"})
		return
	}
	defer rows.Close()

	var suppliers []Supplier
	for rows.Next() {
		var s Supplier
		err := rows.Scan(
			&s.ID, &s.Name, &s.GSTIN, &s.Address, &s.City, &s.State,
			&s.Pincode, &s.Phone, &s.Email, &s.CreatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan supplier data"})
			return
		}
		s.UserID = userID
		suppliers = append(suppliers, s)
	}

	c.JSON(http.StatusOK, gin.H{"suppliers": suppliers})
}

// handleCreateSupplier creates a new supplier
func handleCreateSupplier(c *gin.Context) {
	userID := c.GetInt("userID")

	var supplier Supplier
	if err := c.ShouldBindJSON(&supplier); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid supplier data: " + err.Error()})
		return
	}

	// Validate required fields
	if supplier.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Supplier name is required"})
		return
	}

	// Insert supplier
	var id int
	err := dbPool.QueryRow(context.Background(), `
		INSERT INTO suppliers (
			user_id, name, gstin, address, city, state, pincode, phone, email
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`,
		userID, supplier.Name, supplier.GSTIN, supplier.Address, supplier.City,
		supplier.State, supplier.Pincode, supplier.Phone, supplier.Email,
	).Scan(&id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create supplier: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Supplier created successfully",
		"supplier_id": id,
	})
}

// handleUpdateSupplier updates an existing supplier
func handleUpdateSupplier(c *gin.Context) {
	userID := c.GetInt("userID")
	supplierID := c.Param("id")

	// Validate ID
	id, err := strconv.Atoi(supplierID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid supplier ID"})
		return
	}

	var supplier Supplier
	if err := c.ShouldBindJSON(&supplier); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid supplier data"})
		return
	}

	// Validate required fields
	if supplier.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Supplier name is required"})
		return
	}

	// Check if supplier exists and belongs to user
	var count int
	err = dbPool.QueryRow(context.Background(),
		"SELECT COUNT(*) FROM suppliers WHERE id = $1 AND user_id = $2",
		id, userID).Scan(&count)
	
	if err != nil || count == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Supplier not found or not authorized"})
		return
	}

	// Update supplier
	_, err = dbPool.Exec(context.Background(), `
		UPDATE suppliers
		SET name = $1, gstin = $2, address = $3, city = $4, state = $5,
			pincode = $6, phone = $7, email = $8
		WHERE id = $9 AND user_id = $10
	`,
		supplier.Name, supplier.GSTIN, supplier.Address, supplier.City,
		supplier.State, supplier.Pincode, supplier.Phone, supplier.Email,
		id, userID,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update supplier"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Supplier updated successfully",
		"supplier_id": id,
	})
}

// handleDeleteSupplier deletes a supplier
func handleDeleteSupplier(c *gin.Context) {
	userID := c.GetInt("userID")
	supplierID := c.Param("id")

	// Validate ID
	id, err := strconv.Atoi(supplierID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid supplier ID"})
		return
	}

	// Delete supplier
	result, err := dbPool.Exec(context.Background(),
		"DELETE FROM suppliers WHERE id = $1 AND user_id = $2",
		id, userID,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete supplier"})
		return
	}

	// Check if any row was deleted
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Supplier not found or not authorized"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Supplier deleted successfully",
		"supplier_id": id,
	})
}

// handleDeleteInvoice deletes an invoice
func handleDeleteInvoice(c *gin.Context) {
	userID := c.GetInt("userID")
	invoiceID := c.Param("id")

	// Validate ID
	id, err := strconv.Atoi(invoiceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invoice ID"})
		return
	}

	// Delete invoice
	result, err := dbPool.Exec(context.Background(),
		"DELETE FROM invoices WHERE id = $1 AND user_id = $2",
		id, userID,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete invoice: " + err.Error()})
		return
	}

	// Check if any row was deleted
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found or not authorized"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Invoice deleted successfully",
		"invoice_id": id,
	})
}

// handleDownloadExcelTemplate provides a template Excel file for invoice uploads
func handleDownloadExcelTemplate(c *gin.Context) {
	// Create a new Excel file
	f := excelize.NewFile()
	defer func() {
		if err := f.Close(); err != nil {
			log.Println("Error closing Excel file:", err)
		}
	}()

	// Create the headers
	headers := []string{
		"Invoice No", "Date (DD/MM/YYYY)", "Seller GSTIN", "Seller Legal Name", 
		"Seller Trade Name", "Seller Address1", "Seller Address2", "Seller Location", 
		"Seller PIN", "Seller State", "Seller Phone", "Seller Email",
		"Buyer GSTIN", "Buyer Legal Name", "Buyer Trade Name", 
		"Buyer Address1", "Buyer Address2", "Buyer Location", 
		"Buyer PIN", "Buyer State", "Buyer Phone", "Buyer Email",
		"Item No", "Item Description", "HSN Code", "Quantity", "Unit", 
		"Unit Price", "GST Rate (%)", "Is Service (Y/N)",
	}

	// Set active sheet
	f.SetActiveSheet(0)
	sheetName := "Invoice Template"
	f.SetSheetName("Sheet1", sheetName)

	// Set column headers
	for i, header := range headers {
		col := string(rune('A' + i))
		f.SetCellValue(sheetName, col+"1", header)
	}

	// Add sample data (row 2)
	sampleData := []string{
		"INV-001", "25/03/2023", "27AADCS0472N1Z1", "Sample Seller Ltd", 
		"Sample Trading Co", "123 Business Park", "Floor 4", "Mumbai", 
		"400001", "Maharashtra", "9876543210", "seller@example.com",
		"06AABCS1234Z1Z1", "Sample Buyer Ltd", "Sample Customer", 
		"456 Industrial Area", "Block B", "Delhi", 
		"110001", "Delhi", "8765432109", "buyer@example.com",
		"1", "Computer Monitor", "8471", "2", "PCS", 
		"15000", "18", "N",
	}

	for i, value := range sampleData {
		col := string(rune('A' + i))
		f.SetCellValue(sheetName, col+"2", value)
	}

	// Add a second sample item (row 3)
	secondItem := []string{
		"INV-001", "", "", "", "", "", "", "", "", "", "", "",
		"", "", "", "", "", "", "", "", "", "",
		"2", "Software Service", "9983", "1", "SAC", 
		"25000", "18", "Y",
	}

	for i, value := range secondItem {
		col := string(rune('A' + i))
		f.SetCellValue(sheetName, col+"3", value)
	}

	// Add helper text in a new worksheet
	f.NewSheet("Instructions")
	instructions := []string{
		"Instructions for filling the Excel template:",
		"1. Each row represents an invoice line item",
		"2. For multi-item invoices, repeat the invoice header information with different item details",
		"3. Date format should be DD/MM/YYYY",
		"4. GST Rate should be a number (e.g., 18 for 18%)",
		"5. Is Service should be 'Y' for services or 'N' for goods",
		"6. All required fields must be filled",
		"7. Save the file as Excel (.xlsx) format",
		"8. Upload the completed file through the 'Upload Excel' page",
	}

	for i, text := range instructions {
		f.SetCellValue("Instructions", "A"+strconv.Itoa(i+1), text)
	}

	// Save to buffer
	buf, err := f.WriteToBuffer()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate Excel template"})
		return
	}

	// Set headers for file download
	c.Writer.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Writer.Header().Set("Content-Disposition", "attachment; filename=invoice_template.xlsx")
	c.Writer.Header().Set("Content-Length", fmt.Sprintf("%d", buf.Len()))
	c.Writer.Header().Set("Cache-Control", "no-cache")
	
	// Write the Excel data
	c.Writer.Write(buf.Bytes())
} 