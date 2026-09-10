package pdf

import (
	"bytes"
	"fmt"
	"strings"
)

// SimpleInvoice génère un PDF minimal (Helvetica, sans lib externe).
func SimpleInvoice(title, shop, invNo, orderNo, date string, lines [][3]string, total string) []byte {
	var content strings.Builder
	y := 800
	write := func(s string) {
		content.WriteString(fmt.Sprintf("BT /F1 11 Tf 50 %d Td (%s) Tj ET\n", y, escape(s)))
		y -= 16
	}
	writeBig := func(s string) {
		content.WriteString(fmt.Sprintf("BT /F1 16 Tf 50 %d Td (%s) Tj ET\n", y, escape(s)))
		y -= 22
	}

	writeBig(title)
	write(shop)
	write(fmt.Sprintf("Facture: %s", invNo))
	write(fmt.Sprintf("Commande: %s", orderNo))
	write(fmt.Sprintf("Date: %s", date))
	y -= 10
	write("Article | Qte | Montant")
	write(strings.Repeat("-", 60))
	for _, ln := range lines {
		write(fmt.Sprintf("%s | %s | %s", truncate(ln[0], 40), ln[1], ln[2]))
	}
	y -= 10
	write(fmt.Sprintf("TOTAL: %s Ar", total))
	write("")
	write("L'AMI - Fianarantsoa, Madagascar")

	stream := content.String()
	var buf bytes.Buffer
	buf.WriteString("%PDF-1.4\n")
	offsets := []int{0}

	writeObj := func(n int, body string) {
	offsets = append(offsets, buf.Len())
		buf.WriteString(fmt.Sprintf("%d 0 obj\n%s\nendobj\n", n, body))
	}

	writeObj(1, "<< /Type /Catalog /Pages 2 0 R >>")
	writeObj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
	writeObj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>")
	writeObj(4, fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(stream), stream))
	writeObj(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

	xrefPos := buf.Len()
	buf.WriteString(fmt.Sprintf("xref\n0 %d\n", len(offsets)))
	buf.WriteString("0000000000 65535 f \n")
	for i := 1; i < len(offsets); i++ {
		buf.WriteString(fmt.Sprintf("%010d 00000 n \n", offsets[i]))
	}
	buf.WriteString(fmt.Sprintf("trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(offsets), xrefPos))
	return buf.Bytes()
}

func escape(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "(", "\\(")
	s = strings.ReplaceAll(s, ")", "\\)")
	var b strings.Builder
	for _, r := range s {
		if r < 128 {
			b.WriteRune(r)
		} else {
			b.WriteByte('?')
		}
	}
	return b.String()
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "."
}
