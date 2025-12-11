#!/usr/bin/env node

/**
 * sync-flights.js
 * ===============
 * Syncs flight data from a Google Sheet to the local CSV file used by the
 * flight tracker visualization. Includes comprehensive QA/QC validation.
 * 
 * USAGE
 * -----
 *   GOOGLE_SHEET_ID=<your-sheet-id> node scripts/sync-flights.js
 *   
 *   Or via npm:
 *   GOOGLE_SHEET_ID=<your-sheet-id> npm run sync-flights
 * 
 * ENVIRONMENT VARIABLES
 * ---------------------
 *   GOOGLE_SHEET_ID   - (required) The ID from your Google Sheet URL
 *                       Found in: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit
 *   GOOGLE_SHEET_NAME - (optional) The sheet tab name, defaults to 'Flights'
 * 
 * REQUIREMENTS
 * ------------
 *   The Google Sheet must be publicly accessible:
 *   - Share → Anyone with the link → Viewer
 * 
 * EXPECTED CSV FORMAT
 * -------------------
 *   date,airline,flightNumber,origin,destination
 *   6/15/2008,Continental Airlines,,LAX,IAH
 *   
 *   - date: M/D/YYYY format
 *   - airline: Airline name (will be normalized)
 *   - flightNumber: Optional flight number
 *   - origin: 3-4 letter IATA/ICAO airport code
 *   - destination: 3-4 letter IATA/ICAO airport code
 * 
 * QA/QC CHECKS
 * ------------
 *   The script performs the following validations:
 * 
 *   ERRORS (will abort sync):
 *   - Empty or invalid date format
 *   - Dates before 1990 (likely typo)
 *   - Dates more than 1 year in future (likely typo)
 *   - Invalid dates (e.g., Feb 30)
 *   - Empty or invalid airport codes
 *   - Same origin and destination
 * 
 *   WARNINGS (informational, won't abort):
 *   - Empty airline name
 *   - Airline name corrections applied
 *   - Possible duplicate flights (same date + route)
 *   - Inconsistent airline naming across rows
 * 
 * DATA TRANSFORMATIONS
 * --------------------
 *   - Trims whitespace from all fields
 *   - Removes empty columns
 *   - Normalizes airline names (see AIRLINE_CORRECTIONS)
 *   - Uppercases airport codes
 *   - Uppercases flight numbers
 *   - Sorts flights by date (ascending)
 * 
 * GITHUB ACTIONS
 * --------------
 *   When run in GitHub Actions, outputs 'changed=true' or 'changed=false'
 *   to $GITHUB_OUTPUT for conditional workflow steps.
 */

import { writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Flights';
const OUTPUT_PATH = resolve(__dirname, '../projects/flights/data/flights.csv');

/**
 * Known airline name mappings for consistency.
 * Keys are lowercase, values are the canonical name.
 * Add common variations as needed.
 */
const AIRLINE_CORRECTIONS = {
  'southwest airlines': 'Southwest',
  'southwest air': 'Southwest',
  'american airlines': 'American',
  'united airlines': 'United',
  'delta airlines': 'Delta',
  'delta air lines': 'Delta',
  'jetblue': 'JetBlue',
  'jet blue': 'JetBlue',
  'alaska airlines': 'Alaska',
  'spirit airlines': 'Spirit',
  'frontier airlines': 'Frontier',
};

async function fetchSheetAsCSV(sheetId, sheetName) {
  // Google Sheets CSV export URL with sheet name
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  
  console.log(`📥 Fetching sheet "${sheetName}" from Google Sheets...`);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: ${response.status} ${response.statusText}`);
  }
  
  const csv = await response.text();
  
  // Basic validation - check if we got actual CSV data
  if (!csv || csv.includes('<!DOCTYPE html>')) {
    throw new Error('Received HTML instead of CSV. Make sure the sheet is publicly accessible.');
  }
  
  return csv;
}

/**
 * Parse CSV handling quoted fields properly
 */
function parseCSV(csv) {
  const lines = csv.split('\n').filter(line => line.trim());
  const rows = [];
  
  for (const line of lines) {
    const row = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current);
    rows.push(row);
  }
  
  return rows;
}

/**
 * Convert rows back to CSV
 */
function toCSV(rows) {
  return rows.map(row => 
    row.map(cell => {
      // Quote cells that contain commas, quotes, or newlines
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\n') + '\n';
}

/**
 * Remove empty columns from the data
 */
function trimEmptyColumns(rows) {
  if (rows.length === 0) return rows;
  
  const header = rows[0];
  const dataRows = rows.slice(1);
  
  // Find columns that have at least one non-empty value (or have a header)
  const nonEmptyColIndices = [];
  for (let col = 0; col < header.length; col++) {
    const headerHasValue = header[col].trim() !== '';
    const colHasData = dataRows.some(row => row[col] && row[col].trim() !== '');
    
    if (headerHasValue || colHasData) {
      nonEmptyColIndices.push(col);
    }
  }
  
  // Filter to only non-empty columns
  return rows.map(row => nonEmptyColIndices.map(i => row[i] || ''));
}

/**
 * Validate and parse date string like "6/15/2008"
 * Returns { valid: boolean, date?: Date, error?: string }
 */
function validateDate(dateStr) {
  if (!dateStr || !dateStr.trim()) {
    return { valid: false, error: 'Empty date' };
  }
  
  const trimmed = dateStr.trim();
  const parts = trimmed.split('/');
  
  if (parts.length !== 3) {
    return { valid: false, error: `Invalid format: "${trimmed}" (expected M/D/YYYY)` };
  }
  
  const [month, day, year] = parts.map(Number);
  
  if (isNaN(month) || isNaN(day) || isNaN(year)) {
    return { valid: false, error: `Non-numeric values: "${trimmed}"` };
  }
  
  if (month < 1 || month > 12) {
    return { valid: false, error: `Invalid month ${month}: "${trimmed}"` };
  }
  
  if (day < 1 || day > 31) {
    return { valid: false, error: `Invalid day ${day}: "${trimmed}"` };
  }
  
  if (year < 1990) {
    return { valid: false, error: `Year too old (${year}): "${trimmed}"` };
  }
  
  const date = new Date(year, month - 1, day);
  const now = new Date();
  
  // Check if date is valid (e.g., Feb 30 would fail)
  if (date.getMonth() !== month - 1 || date.getDate() !== day) {
    return { valid: false, error: `Invalid date: "${trimmed}"` };
  }
  
  // Allow flights up to 1 year in the future (for booked flights)
  const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  
  if (date > oneYearFromNow) {
    return { valid: false, error: `Date too far in future (${year}): "${trimmed}" - likely a typo` };
  }
  
  return { valid: true, date };
}

/**
 * Validate airport code (3-4 letter IATA/ICAO code)
 */
function validateAirportCode(code) {
  if (!code || !code.trim()) {
    return { valid: false, error: 'Empty airport code' };
  }
  
  const trimmed = code.trim().toUpperCase();
  
  if (!/^[A-Z]{3,4}$/.test(trimmed)) {
    return { valid: false, error: `Invalid airport code: "${code}"` };
  }
  
  return { valid: true, normalized: trimmed };
}

/**
 * Normalize airline name for consistency
 */
function normalizeAirline(airline) {
  if (!airline || !airline.trim()) {
    return { normalized: '', warning: 'Empty airline name' };
  }
  
  let trimmed = airline.trim();
  
  // Check for corrections
  const lowerKey = trimmed.toLowerCase();
  if (AIRLINE_CORRECTIONS[lowerKey]) {
    const corrected = AIRLINE_CORRECTIONS[lowerKey];
    // Only report as corrected if it actually changed
    if (corrected !== trimmed) {
      return { 
        normalized: corrected, 
        corrected: true,
        original: trimmed 
      };
    }
    return { normalized: corrected };
  }
  
  return { normalized: trimmed };
}

/**
 * Run QA/QC checks on the data
 */
function runQAQC(rows) {
  if (rows.length <= 1) return { rows, errors: [], warnings: [] };
  
  const header = rows[0].map(h => h.trim().toLowerCase());
  const dataRows = rows.slice(1);
  
  // Find column indices
  const dateIdx = header.findIndex(h => h === 'date');
  const airlineIdx = header.findIndex(h => h === 'airline');
  const originIdx = header.findIndex(h => h === 'origin');
  const destIdx = header.findIndex(h => h === 'destination');
  const flightNumIdx = header.findIndex(h => h === 'flightnumber' || h === 'flight number' || h === 'flight_number');
  
  const errors = [];
  const warnings = [];
  const seenFlights = new Map(); // For duplicate detection
  const airlineVariations = new Map(); // Track airline name variations
  
  const cleanedRows = [rows[0].map(h => h.trim())]; // Clean header
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2; // 1-indexed, plus header
    const cleanRow = [...row];
    let hasError = false;
    
    // Trim all fields
    for (let j = 0; j < cleanRow.length; j++) {
      cleanRow[j] = (cleanRow[j] || '').trim();
    }
    
    // Validate date
    if (dateIdx !== -1) {
      const dateResult = validateDate(cleanRow[dateIdx]);
      if (!dateResult.valid) {
        errors.push(`Row ${rowNum}: ${dateResult.error}`);
        hasError = true;
      }
    }
    
    // Validate and normalize airline
    if (airlineIdx !== -1) {
      const airlineResult = normalizeAirline(cleanRow[airlineIdx]);
      if (airlineResult.warning) {
        warnings.push(`Row ${rowNum}: ${airlineResult.warning}`);
      }
      if (airlineResult.corrected) {
        warnings.push(`Row ${rowNum}: Corrected airline "${airlineResult.original}" → "${airlineResult.normalized}"`);
      }
      cleanRow[airlineIdx] = airlineResult.normalized;
      
      // Track variations
      if (airlineResult.normalized) {
        const key = airlineResult.normalized.toLowerCase();
        if (!airlineVariations.has(key)) {
          airlineVariations.set(key, new Set());
        }
        airlineVariations.get(key).add(airlineResult.normalized);
      }
    }
    
    // Validate origin airport
    if (originIdx !== -1) {
      const originResult = validateAirportCode(cleanRow[originIdx]);
      if (!originResult.valid) {
        errors.push(`Row ${rowNum}: Origin - ${originResult.error}`);
        hasError = true;
      } else {
        cleanRow[originIdx] = originResult.normalized;
      }
    }
    
    // Validate destination airport
    if (destIdx !== -1) {
      const destResult = validateAirportCode(cleanRow[destIdx]);
      if (!destResult.valid) {
        errors.push(`Row ${rowNum}: Destination - ${destResult.error}`);
        hasError = true;
      } else {
        cleanRow[destIdx] = destResult.normalized;
      }
    }
    
    // Check for same origin and destination
    if (originIdx !== -1 && destIdx !== -1) {
      if (cleanRow[originIdx] && cleanRow[destIdx] && 
          cleanRow[originIdx] === cleanRow[destIdx]) {
        errors.push(`Row ${rowNum}: Origin and destination are the same (${cleanRow[originIdx]})`);
        hasError = true;
      }
    }
    
    // Check for duplicates (same date, origin, destination)
    if (dateIdx !== -1 && originIdx !== -1 && destIdx !== -1) {
      const flightKey = `${cleanRow[dateIdx]}|${cleanRow[originIdx]}|${cleanRow[destIdx]}`;
      if (seenFlights.has(flightKey)) {
        warnings.push(`Row ${rowNum}: Possible duplicate of row ${seenFlights.get(flightKey)} (${cleanRow[dateIdx]}: ${cleanRow[originIdx]} → ${cleanRow[destIdx]})`);
      } else {
        seenFlights.set(flightKey, rowNum);
      }
    }
    
    // Normalize flight number (trim, uppercase)
    if (flightNumIdx !== -1 && cleanRow[flightNumIdx]) {
      cleanRow[flightNumIdx] = cleanRow[flightNumIdx].toUpperCase();
    }
    
    cleanedRows.push(cleanRow);
  }
  
  // Check for inconsistent airline naming
  for (const [key, variations] of airlineVariations) {
    if (variations.size > 1) {
      warnings.push(`Inconsistent airline naming: ${Array.from(variations).join(', ')}`);
    }
  }
  
  return { rows: cleanedRows, errors, warnings };
}

/**
 * Parse date string like "6/15/2008" to sortable value
 */
function parseDateForSort(dateStr) {
  if (!dateStr) return 0;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return 0;
  const [month, day, year] = parts.map(Number);
  return new Date(year, month - 1, day).getTime();
}

/**
 * Sort rows by date (assumes date is first column after header)
 */
function sortByDate(rows) {
  if (rows.length <= 1) return rows;
  
  const header = rows[0];
  const dataRows = rows.slice(1);
  
  // Find date column index (look for 'date' in header)
  const dateColIndex = header.findIndex(h => h.toLowerCase() === 'date');
  if (dateColIndex === -1) {
    console.log('⚠️  No "date" column found, skipping sort');
    return rows;
  }
  
  dataRows.sort((a, b) => {
    const dateA = parseDateForSort(a[dateColIndex]);
    const dateB = parseDateForSort(b[dateColIndex]);
    return dateA - dateB;
  });
  
  return [header, ...dataRows];
}

function hasChanges(newCSV, existingPath) {
  try {
    const existing = readFileSync(existingPath, 'utf-8');
    return existing.trim() !== newCSV.trim();
  } catch {
    // File doesn't exist, so there are "changes"
    return true;
  }
}

async function main() {
  if (!SHEET_ID) {
    console.error('❌ Error: GOOGLE_SHEET_ID environment variable is required');
    console.error('');
    console.error('Usage:');
    console.error('  GOOGLE_SHEET_ID=your-sheet-id node scripts/sync-flights.js');
    console.error('');
    console.error('Find your Sheet ID in the URL:');
    console.error('  https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit');
    process.exit(1);
  }

  try {
    const rawCSV = await fetchSheetAsCSV(SHEET_ID, SHEET_NAME);
    
    // Parse the data
    let rows = parseCSV(rawCSV);
    console.log(`📊 Fetched ${rows.length - 1} flights`);
    
    // Trim empty columns
    rows = trimEmptyColumns(rows);
    console.log(`🧹 Trimmed to ${rows[0].length} columns`);
    
    // Run QA/QC
    console.log(`\n🔍 Running QA/QC checks...`);
    const { rows: cleanedRows, errors, warnings } = runQAQC(rows);
    rows = cleanedRows;
    
    // Report warnings
    if (warnings.length > 0) {
      console.log(`\n⚠️  ${warnings.length} warning(s):`);
      warnings.forEach(w => console.log(`   ${w}`));
    }
    
    // Report errors
    if (errors.length > 0) {
      console.log(`\n❌ ${errors.length} error(s):`);
      errors.forEach(e => console.log(`   ${e}`));
      console.error(`\n🛑 Fix the errors above before syncing.`);
      process.exit(1);
    }
    
    console.log(`✅ QA/QC passed`);
    
    // Sort by date
    rows = sortByDate(rows);
    console.log(`📅 Sorted by date`);
    
    const cleanCSV = toCSV(rows);
    
    if (hasChanges(cleanCSV, OUTPUT_PATH)) {
      writeFileSync(OUTPUT_PATH, cleanCSV);
      console.log(`\n✅ Updated ${OUTPUT_PATH}`);
      
      // Output for GitHub Actions
      if (process.env.GITHUB_OUTPUT) {
        writeFileSync(process.env.GITHUB_OUTPUT, 'changed=true\n', { flag: 'a' });
      }
    } else {
      console.log('ℹ️  No changes detected');
      
      if (process.env.GITHUB_OUTPUT) {
        writeFileSync(process.env.GITHUB_OUTPUT, 'changed=false\n', { flag: 'a' });
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
