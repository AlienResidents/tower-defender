#!/usr/bin/env bash

# Ensure a run count is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <number_of_runs>"
    exit 1
fi

RUNS=$1

# Configurable array of sides
D_SIDES=(3 6 8 10 12 20 100)
ANCHOR=3

echo "=================================================="
echo "Simulating $RUNS runs for multiple side configurations..."
echo "=================================================="

# Check if 'bc' is available for accurate decimals
HAS_BC=0
if command -v bc &> /dev/null; then
    HAS_BC=1
fi

# Array to store result strings for the final summary
RESULTS=()

# Iterate through the array of sides
for SIDES in "${D_SIDES[@]}"; do
    few_dice_count=$ANCHOR
    few_dice_sides=$SIDES
    
    many_dice_count=$SIDES
    many_dice_sides=$ANCHOR

    total_few=0
    total_many=0

    # Simulation Loop
    for ((i=1; i<=RUNS; i++)); do
        # Roll the few, high-sided dice config
        for ((j=1; j<=few_dice_count; j++)); do
            total_few=$(( total_few + (RANDOM % few_dice_sides) + 1 ))
        done

        # Roll the many, low-sided dice config
        for ((k=1; k<=many_dice_count; k++)); do
            total_many=$(( total_many + (RANDOM % many_dice_sides) + 1 ))
        done
    done

    # Calculate Averages accurately
    if [ $HAS_BC -eq 1 ]; then
        avg_few=$(echo "scale=2; $total_few / $RUNS" | bc)
        avg_many=$(echo "scale=2; $total_many / $RUNS" | bc)
    else
        avg_few=$(( total_few / RUNS )).$(( (total_few * 100 / RUNS) % 100 ))
        avg_many=$(( total_many / RUNS )).$(( (total_many * 100 / RUNS) % 100 ))
    fi

    # FIXED: Using the correct 'many_dice_count' and 'many_dice_sides' variables here
    formatted_line=$(printf "Rolls: %dd%-3d | Avg: %-6s || Rolls: %-3dd%d | Avg: %s" \
        "$few_dice_count" "$few_dice_sides" "$avg_few" \
        "$many_dice_count" "$many_dice_sides" "$avg_many")
        
    RESULTS+=("$formatted_line")
done

# Print final summary list
echo ""
echo "=================================================="
echo "                 FINAL SUMMARY                    "
echo "=================================================="
for line in "${RESULTS[@]}"; do
    echo "$line"
done
echo "=================================================="

