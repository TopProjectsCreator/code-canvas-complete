package output

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"text/tabwriter"

	"gopkg.in/yaml.v3"
)

const (
	colorReset  = "\033[0m"
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorCyan   = "\033[36m"
	colorBold   = "\033[1m"
)

var outputWriter io.Writer = os.Stdout

func SetOutput(w io.Writer) {
	outputWriter = w
}

func Green(text string) string {
	return colorGreen + text + colorReset
}

func Red(text string) string {
	return colorRed + text + colorReset
}

func Yellow(text string) string {
	return colorYellow + text + colorReset
}

func Cyan(text string) string {
	return colorCyan + text + colorReset
}

func Bold(text string) string {
	return colorBold + text + colorReset
}

func PrintSuccess(msg string) {
	fmt.Fprintln(outputWriter, Green("✓ "+msg))
}

func PrintError(msg string) {
	fmt.Fprintln(outputWriter, Red("✗ "+msg))
}

func PrintWarning(msg string) {
	fmt.Fprintln(outputWriter, Yellow("⚠ "+msg))
}

func PrintInfo(msg string) {
	fmt.Fprintln(outputWriter, Cyan("ℹ "+msg))
}

func PrintTable(headers []string, rows [][]string) {
	w := tabwriter.NewWriter(outputWriter, 0, 0, 2, ' ', 0)

	headerLine := strings.Join(headers, "\t")
	fmt.Fprintln(w, Bold(headerLine))

	for _, row := range rows {
		cols := make([]string, len(headers))
		for i := range headers {
			if i < len(row) {
				cols[i] = row[i]
			} else {
				cols[i] = ""
			}
		}
		fmt.Fprintln(w, strings.Join(cols, "\t"))
	}

	w.Flush()
}

func PrintJSON(data interface{}) error {
	encoder := json.NewEncoder(outputWriter)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(data); err != nil {
		return fmt.Errorf("encoding JSON: %w", err)
	}
	return nil
}

func PrintYAML(data interface{}) error {
	out, err := yaml.Marshal(data)
	if err != nil {
		return fmt.Errorf("encoding YAML: %w", err)
	}
	_, err = fmt.Fprint(outputWriter, string(out))
	return err
}

func FormatOutput(format string, data interface{}) error {
	switch format {
	case "json":
		return PrintJSON(data)
	case "yaml":
		return PrintYAML(data)
	case "table":
		if t, ok := data.(TableData); ok {
			PrintTable(t.Headers, t.Rows)
			return nil
		}
		return PrintJSON(data)
	default:
		return PrintJSON(data)
	}
}

type TableData struct {
	Headers []string
	Rows    [][]string
}

type Table struct {
	headers []string
	rows    [][]string
}

func NewTable(headers ...string) *Table {
	return &Table{headers: headers}
}

func (t *Table) AddRow(cols ...string) {
	t.rows = append(t.rows, cols)
}

func (t *Table) Print() {
	PrintTable(t.headers, t.rows)
}
