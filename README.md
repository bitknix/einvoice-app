# E-Invoice App

A modern invoicing application for generating and managing GST-compliant invoices.

## Environment Setup

### Backend Setup

1. Copy the example environment file:
   ```
   cp backend/.env.example backend/.env
   ```

2. Edit the `.env` file with your database and JWT settings:
   ```
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your-password
   DB_NAME=einvoice

   # JWT Configuration
   JWT_SECRET=your-secure-jwt-secret

   # Server Configuration
   PORT=8080
   ```

3. Install Go dependencies:
   ```
   cd backend
   go mod download
   ```

4. Run the backend:
   ```
   go run main.go
   ```

### Frontend Setup

1. Copy the example environment file:
   ```
   cp frontend/.env.example frontend/.env
   ```

2. Edit the `.env` file with your API URL:
   ```
   # For local development
   REACT_APP_API_URL=http://localhost:8080
   ```

3. Install dependencies:
   ```
   cd frontend
   npm install
   ```

4. Run the frontend:
   ```
   npm start
   ```

## Deployment

### Backend Deployment (Render/Railway)

1. Set the following environment variables in your cloud provider dashboard:
   - `DB_HOST`
   - `DB_PORT`
   - `DB_USER`
   - `DB_PASSWORD`
   - `DB_NAME`
   - `JWT_SECRET`
   - `PORT` (usually set automatically by the platform)

2. Connect your repository and deploy the backend.

### Frontend Deployment (Vercel/Netlify)

1. Set the following environment variables in your deployment dashboard:
   - `REACT_APP_API_URL` (URL of your deployed backend API)

2. Connect your repository and deploy the frontend.

## Features

- **GST-Compliant Invoices**: Generate e-invoices that comply with Indian GST requirements
- **Excel Import/Export**: Import invoice data from Excel and export invoices to Excel
- **QR Code Generation**: Automatically generate QR codes for each invoice
- **User Authentication**: Secure login and registration system
- **PostgreSQL Database**: Store all invoice and user data in PostgreSQL
- **Modern UI**: Clean and responsive user interface built with Material UI

## Tech Stack

### Backend
- Go with Gin web framework
- PostgreSQL database with pgx driver
- JWT authentication
- Excel processing with excelize
- QR code generation with go-qrcode

### Frontend
- React.js
- Material UI for components
- React Router for navigation
- React Hook Form for form handling
- Axios for API requests
- File-Saver for downloads
- QRCode.react for QR code display

## Getting Started

### Prerequisites

- Go 1.18 or higher
- Node.js 14.x or higher
- PostgreSQL 12.x or higher

### Setup Database

1. Create a PostgreSQL database named `einvoice_db`:
   ```sql
   CREATE DATABASE einvoice_db;
   ```

2. Update the database connection settings in `backend/main.go` if needed:
   ```go
   const (
       dbHost     = "localhost"
       dbPort     = 5432
       dbUser     = "postgres"
       dbPassword = "mypass"
       dbName     = "einvoice_db"
   )
   ```

### Run Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   go mod tidy
   ```

3. Run the server:
   ```bash
   go run main.go
   ```

The backend server will start on port 8080.

### Run Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

The frontend application will run on port 3000 and proxy API requests to the backend.

## API Endpoints

### Authentication
- `POST /api/register`: Register a new user
- `POST /api/login`: Login and get JWT token

### Invoices
- `POST /api/generate-invoice`: Generate a new invoice
- `POST /api/upload-excel`: Import invoices from Excel
- `GET /api/export-invoices`: Export invoices to Excel
- `GET /api/invoices`: Get all invoices for the user
- `GET /api/qr/:id`: Get QR code for an invoice

## Invoice JSON Schema

The application uses the following JSON schema for invoices:

```json
{
  "Version": "1.1",
  "TranDtls": {
    "TaxSch": "GST",
    "SupTyp": "EXPWP",
    "RegRev": "N"
  },
  "DocDtls": {
    "Typ": "INV",
    "No": "MISL/24-25/2544",
    "Dt": "27/03/2025"
  },
  "SellerDtls": {
    "Gstin": "06AABFM7416P1ZY",
    "LglNm": "MITTAL INTERNATIONAL",
    "TrdNm": "MITTAL INTERNATIONAL",
    "Addr1": "PLOT NO 275",
    "Addr2": "SECTOR 29 PART-II,HUDA",
    "Loc": "PANIPAT",
    "Pin": 132103,
    "Stcd": "06"
  },
  "BuyerDtls": {
    "Gstin": "URP",
    "LglNm": "M/S. SPOTLIGHT  PTY. LTD.",
    "TrdNm": "M/S. SPOTLIGHT  PTY. LTD.",
    "Pos": "96",
    "Addr1": "L6  111 CECIL STREET 3205,",
    "Addr2": "SOUTH MELBOURNE",
    "Loc": "AUSTRALIA",
    "Pin": 999999,
    "Stcd": "96"
  },
  "ItemList": [
    {
      "SlNo": "1",
      "PrdDesc": "100% JUTE WOVEN FABRIC",
      "IsServc": "N",
      "HsnCd": "53101013",
      "Qty": 750,
      "Unit": "MTR",
      "UnitPrice": 140.384,
      "TotAmt": 105288,
      "AssAmt": 105288,
      "GstRt": 5,
      "IgstAmt": 5264.4,
      "TotItemVal": 110552.4
    }
  ],
  "ValDtls": {
    "AssVal": 431021.68,
    "IgstVal": 21551.08,
    "TotInvVal": 452572.76
  },
  "ExpDtls": {
    "ForCur": null,
    "CntCode": null
  }
}
```

## License

This project is licensed under the MIT License.

## Acknowledgements

- [Gin Web Framework](https://github.com/gin-gonic/gin)
- [React.js](https://reactjs.org/)
- [Material UI](https://mui.com/)
- [excelize](https://github.com/xuri/excelize) 