package models

import (
	"encoding/json"
	"errors"
	"regexp"
	"time"
)

// Invoice represents the database model for an invoice
type Invoice struct {
	ID         int       `json:"id" db:"id"`
	UserID     int       `json:"user_id" db:"user_id"`
	SellerGSTIN string    `json:"seller_gstin" db:"seller_gstin"`
	InvoiceNo  string    `json:"invoice_no" db:"invoice_no"`
	InvoiceJSON json.RawMessage `json:"invoice_json" db:"invoice_json"`
	QRCode     []byte    `json:"qr_code" db:"qr_code"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

// E-Invoice schema as per the GST requirement
type EInvoice struct {
	Version   string    `json:"Version"`
	TranDtls  TranDtls  `json:"TranDtls"`
	DocDtls   DocDtls   `json:"DocDtls"`
	SellerDtls SellerDtls `json:"SellerDtls"`
	BuyerDtls  BuyerDtls  `json:"BuyerDtls"`
	ItemList  []Item    `json:"ItemList"`
	ValDtls   ValDtls   `json:"ValDtls"`
	ExpDtls   ExpDtls   `json:"ExpDtls"`
}

// TranDtls contains transaction details
type TranDtls struct {
	TaxSch  string `json:"TaxSch"`
	SupTyp  string `json:"SupTyp"`
	RegRev  string `json:"RegRev"`
}

// DocDtls contains document details
type DocDtls struct {
	Typ string `json:"Typ"`
	No  string `json:"No"`
	Dt  string `json:"Dt"`
}

// SellerDtls contains seller details
type SellerDtls struct {
	Gstin string `json:"Gstin"`
	LglNm string `json:"LglNm"`
	TrdNm string `json:"TrdNm"`
	Addr1 string `json:"Addr1"`
	Addr2 string `json:"Addr2"`
	Loc   string `json:"Loc"`
	Pin   int    `json:"Pin"`
	Stcd  string `json:"Stcd"`
}

// BuyerDtls contains buyer details
type BuyerDtls struct {
	Gstin string `json:"Gstin"`
	LglNm string `json:"LglNm"`
	TrdNm string `json:"TrdNm"`
	Pos   string `json:"Pos"`
	Addr1 string `json:"Addr1"`
	Addr2 string `json:"Addr2"`
	Loc   string `json:"Loc"`
	Pin   int    `json:"Pin"`
	Stcd  string `json:"Stcd"`
}

// Item represents an invoice line item
type Item struct {
	SlNo      string  `json:"SlNo"`
	PrdDesc   string  `json:"PrdDesc"`
	IsServc   string  `json:"IsServc"`
	HsnCd     string  `json:"HsnCd"`
	Qty       float64 `json:"Qty"`
	Unit      string  `json:"Unit"`
	UnitPrice float64 `json:"UnitPrice"`
	TotAmt    float64 `json:"TotAmt"`
	AssAmt    float64 `json:"AssAmt"`
	GstRt     float64 `json:"GstRt"`
	IgstAmt   float64 `json:"IgstAmt"`
	TotItemVal float64 `json:"TotItemVal"`
}

// ValDtls contains value details
type ValDtls struct {
	AssVal    float64 `json:"AssVal"`
	IgstVal   float64 `json:"IgstVal"`
	TotInvVal float64 `json:"TotInvVal"`
}

// ExpDtls contains export details
type ExpDtls struct {
	ForCur  interface{} `json:"ForCur"`
	CntCode interface{} `json:"CntCode"`
}

// Validate checks if the invoice data is valid
func (i *EInvoice) Validate() error {
	// Validate GSTIN format (15 characters)
	gstinRegex := regexp.MustCompile(`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$`)
	if !gstinRegex.MatchString(i.SellerDtls.Gstin) {
		return errors.New("invalid seller GSTIN format")
	}

	// Validate items
	for _, item := range i.ItemList {
		if item.Qty < 0 {
			return errors.New("quantity cannot be negative")
		}
		if item.UnitPrice <= 0 {
			return errors.New("unit price must be greater than zero")
		}
	}

	return nil
}

// CalculateTotals calculates and updates all totals in the invoice
func (i *EInvoice) CalculateTotals() {
	var totalAssVal float64
	var totalIgstVal float64

	for j := range i.ItemList {
		// Calculate total amount
		i.ItemList[j].TotAmt = i.ItemList[j].Qty * i.ItemList[j].UnitPrice
		i.ItemList[j].AssAmt = i.ItemList[j].TotAmt
		
		// Calculate IGST amount
		i.ItemList[j].IgstAmt = i.ItemList[j].AssAmt * i.ItemList[j].GstRt / 100
		
		// Calculate total item value
		i.ItemList[j].TotItemVal = i.ItemList[j].AssAmt + i.ItemList[j].IgstAmt
		
		// Add to invoice totals
		totalAssVal += i.ItemList[j].AssAmt
		totalIgstVal += i.ItemList[j].IgstAmt
	}

	// Update invoice value details
	i.ValDtls.AssVal = totalAssVal
	i.ValDtls.IgstVal = totalIgstVal
	i.ValDtls.TotInvVal = totalAssVal + totalIgstVal
} 