export type CsvImportRecord = {
  rawName: string
  rawBarcode?: string
  rawQuantity?: number
  rawPrice?: number
}

export type CsvParseError = {
  code:
    | 'missing_name_header'
    | 'missing_name_cell'
    | 'malformed_csv'
    | 'invalid_numeric_cell'
  message: string
  column?: 'quantity' | 'price'
  row?: number
}

export type CsvParseResult =
  | { ok: true, records: CsvImportRecord[] }
  | { ok: false, error: CsvParseError }

const normalizeHeader = (value: string) => value.trim().toLowerCase()

type HeaderName = 'name' | 'barcode' | 'quantity' | 'price'

const HEADER_ALIASES: Record<HeaderName, readonly string[]> = {
  name: ['name', 'product', 'product name', 'наименование'],
  barcode: ['barcode', 'ean', 'штрихкод'],
  quantity: ['quantity', 'qty', 'кол-во', 'количество'],
  price: ['price', 'цена', 'стоимость'],
}

const findHeaderIndex = (headers: string[], name: HeaderName) =>
  headers.findIndex((header) => HEADER_ALIASES[name].includes(header))

const detectDelimiter = (source: string) => {
  let quoted = false
  let commas = 0
  let semicolons = 0

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (!quoted && (character === '\n' || character === '\r')) {
      break
    }

    if (!quoted && character === ',') commas += 1
    if (!quoted && character === ';') semicolons += 1
  }

  return semicolons > commas ? ';' : ','
}

const parseRows = (source: string, delimiter: string) => {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let closedQuote = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          quoted = false
          closedQuote = true
        }
      } else {
        cell += character
      }
      continue
    }

    if (character === '"') {
      if (cell.trim()) {
        return null
      }
      quoted = true
      continue
    }

    if (character === delimiter) {
      row.push(cell)
      cell = ''
      closedQuote = false
      continue
    }

    if (closedQuote && !/\s/.test(character)) return null

    if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(cell)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      cell = ''
      closedQuote = false
      continue
    }

    cell += character
  }

  if (quoted) return null

  row.push(cell)
  if (row.some((value) => value.trim())) rows.push(row)
  return rows
}

const parseNumericCell = (value: string) => {
  const compact = value.trim().replace(/[\s\u00a0]/g, '')

  if (!compact) return undefined
  if (!/^[+-]?[\d.,]+$/.test(compact)) return null

  const commaIndex = compact.lastIndexOf(',')
  const dotIndex = compact.lastIndexOf('.')
  const decimalIndex = Math.max(commaIndex, dotIndex)
  const normalized = decimalIndex < 0
    ? compact.replace(/[.,]/g, '')
    : `${compact.slice(0, decimalIndex).replace(/[.,]/g, '')}.${compact.slice(decimalIndex + 1)}`
  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : null
}

export function parseSellerCsv(source: string): CsvParseResult {
  const normalizedSource = source.replace(/^\uFEFF/, '')
  const rows = parseRows(normalizedSource, detectDelimiter(normalizedSource))

  if (!rows) {
    return {
      ok: false,
      error: {
        code: 'malformed_csv',
        message: 'The CSV contains an unclosed or misplaced quote',
      },
    }
  }

  const headers = (rows[0] ?? []).map(normalizeHeader)
  const nameIndex = findHeaderIndex(headers, 'name')

  if (nameIndex < 0) {
    return {
      ok: false,
      error: {
        code: 'missing_name_header',
        message: 'A name header is required',
      },
    }
  }

  const barcodeIndex = findHeaderIndex(headers, 'barcode')
  const quantityIndex = findHeaderIndex(headers, 'quantity')
  const priceIndex = findHeaderIndex(headers, 'price')
  const records: CsvImportRecord[] = []

  for (const [index, cells] of rows.slice(1).entries()) {
    const values = cells.map((cell) => cell.trim())
    const record: CsvImportRecord = { rawName: values[nameIndex] ?? '' }
    const barcode = values[barcodeIndex]
    const quantity = values[quantityIndex]
    const price = values[priceIndex]
    const parsedQuantity = quantity === undefined ? undefined : parseNumericCell(quantity)
    const parsedPrice = price === undefined ? undefined : parseNumericCell(price)

    if (!record.rawName) {
      return {
        ok: false,
        error: {
          code: 'missing_name_cell',
          message: 'The name cell is required',
          row: index + 2,
        },
      }
    }

    const invalidQuantity =
      parsedQuantity === null ||
      (parsedQuantity !== undefined &&
        (parsedQuantity < 0 ||
          parsedQuantity > 2147483647 ||
          !Number.isInteger(parsedQuantity)))
    const invalidPrice =
      parsedPrice === null ||
      (parsedPrice !== undefined && parsedPrice < 0)

    if (invalidQuantity || invalidPrice) {
      const column = invalidQuantity ? 'quantity' : 'price'
      return {
        ok: false,
        error: {
          code: 'invalid_numeric_cell',
          message: column === 'quantity'
            ? 'The quantity cell must contain a nonnegative integer'
            : 'The price cell must contain a nonnegative number',
          column,
          row: index + 2,
        },
      }
    }

    if (barcode) record.rawBarcode = barcode
    if (parsedQuantity !== undefined) record.rawQuantity = parsedQuantity
    if (parsedPrice !== undefined) record.rawPrice = parsedPrice
    records.push(record)
  }

  return { ok: true, records }
}
