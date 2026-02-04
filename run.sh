#!/bin/bash

# Quick Start Script for ScheDool Integrated System
# This script runs the complete integrated workflow

echo "=================================================="
echo "ScheDool Integrated Scheduler - Quick Start"
echo "=================================================="
echo ""

# Check if input_dataset exists
if [ ! -d "input_dataset" ]; then
    echo "❌ Error: input_dataset/ directory not found!"
    echo "Please create it and add your 8 CSV files."
    exit 1
fi

# Count CSV files
CSV_COUNT=$(ls input_dataset/*.csv 2>/dev/null | wc -l | tr -d ' ')
echo "✓ Found $CSV_COUNT CSV files in input_dataset/"

# Check for required files
REQUIRED_FILES=("curriculum.csv" "elective.csv" "teacher.csv" "period.csv" "preplace.csv" "room.csv" "student.csv" "scout.csv")
MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "input_dataset/$file" ]; then
        MISSING_FILES+=("$file")
    else
        echo "  ✓ $file"
    fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo ""
    echo "❌ Missing required files:"
    for file in "${MISSING_FILES[@]}"; do
        echo "  - $file"
    done
    exit 1
fi

echo ""
echo "=================================================="
echo "Running Integrated System..."
echo "=================================================="
echo ""

# Run the integrated main script
python integrated_main.py
