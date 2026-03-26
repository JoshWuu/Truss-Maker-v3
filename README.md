# Truss Builder

Interactive 2D truss design and analysis tool built for the MTE119 truss project.

Try it live: https://truss-maker-v3.vercel.app/

---

## Overview

Truss Builder lets you design, analyze, and optimize truss structures directly in your browser. You can place joints, connect members, apply loads, and instantly see structural behavior and cost based on the course rules.

The goal is simple: build a valid truss that meets all constraints while minimizing cost.

---

## Features

### Interactive Design

* Place joints (x, y coordinates)
* Drag to reposition with high precision
* Connect joints to create members
* Snap to grid for clean geometry

### Precision Controls

* Adjustable coordinate precision (decimal places)
* Arrow key movement for fine tuning
* Configurable movement step size (0.01 m to 1 m)
* Direct numeric input for exact positioning

### Structural Analysis

* Real-time member length calculation
* Method of joints force solving
* Tension and compression visualization
* Automatic determinacy check:
  m = 2n - 3

### Constraints Checking

Live validation of:

* Member length ≤ 3 m
* Member force ≤ 12 kN
* Proper support conditions
* 4 m by 4 m clearance requirement
* Vertical load enforcement

### Cost Calculation (MTE119 Rules)

* Members: $12 per meter
* Joints: $3 each
* Pylons: $6 per meter
* Ropes: $4 each

Displays:

* Total member length
* Full cost breakdown
* Final total cost

### Math Transparency

* Shows member length calculations
* Displays forces at each joint
* Clear indication of valid vs invalid members

### Export

* Export design as JSON
* Export image (PNG/SVG)
* Export calculation report (for submissions)

---

## How to Use

1. Add joints by clicking on the canvas
2. Connect joints to form members
3. Assign supports (pinned or roller)
4. Add vertical loads to joints
5. Adjust geometry using drag, arrow keys, or direct input
6. Check constraints and cost in the side panel
7. Optimize your design to minimize cost while staying valid

---

## Tech Stack

* React
* TypeScript
* Tailwind CSS
* SVG for rendering

---

## Project Context

This tool was built to support the University of Waterloo MTE119 truss design project. It follows the exact cost model and constraints defined in the assignment.

---

## Future Improvements

* Better force diagram visualization
* Optimization suggestions for cheaper designs
* Save/load multiple designs
* Undo/redo system

---

## Author

Josh Wu

---

## Screenshots

### Main Canvas
![Main Canvas](image.png)

### Joint Placement and Precision Controls
![Joint Controls](image-1.png)

### Structural Analysis View
![Analysis](image-2.png)

### Cost Breakdown Panel
![Cost Panel](image-3.png)

### Constraint Validation
![Constraints](image-4.png)
---
## Notes

This tool is designed for learning and project support. Always verify final calculations by hand if required by your course.
