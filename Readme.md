# Drone Movement Simulation – Express.js + Three.js

This project is a small web application that simulates drones moving in 3D space using Three.js for rendering and Express.js as the backend server.
It loads 3D drone models, textures, and waypoint data to create smooth animations in the browser.

## Author
- Toudjani - Abdoul Majid

## Features

- 3D drone visualization in the browser (OBJ + textures)
- Smooth movement based on waypoint JSON files
- Express.js backend serving pages and assets
- Simple routing and clean project structure
- Modular front-end script (drones_rendering.js)
- EJS template engine for rendering the UI

## Project Structure
```
drones_animations/
│
├── controllers/                    # Express controllers
│   └── home.controller.js
│
├── routes/                         # Express routes
│   └── home.route.js
│
├── public/                         # Static client-side files
│   ├── scripts/
│   │   └── drones_rendering.js    # Three.js rendering logic (entry point client-side)
│   │
│   ├── data/
│   │   ├── waypoints.json
│   │   ├── waypoints2.json
│   │   └── waypoints3.json        # Drone path definitions
│   │
│   └── models/                    # 3D models + textures
│       ├── drone.obj
│       ├── professional_drone.mtl
│       ├── *.png                  # Material textures
│       ├── *.jpg                  # Material textures
│       ├── ciel.jpg               # Sky texture
│       └── sol.jpg                # Ground texture
│
├── views/                         # EJS templates
│   └── pages/
│       └── home.ejs
│
├── server.js                      # Main Express.js server (entry point)
├── package.json
└── package-lock.json
```

## Installation

Make sure you have **Node.js** installed.
```bash
npm install
```

This will install Express and all required modules.

## Run the Server

Start the Express server:
```bash
node server.js
```

You should see:
```
Server running on http://localhost:5833
```

## 🌐 Open the Application

Go to: **http://localhost:5833**

The browser will load the EJS page and the Three.js script (`public/scripts/drones_rendering.js`) will start rendering the drone animation.

## How It Works

### 1. Server side (Node / Express)

- `server.js` configures Express, routing, static files, and the EJS engine
- `home.controller.js` prepares data for the home page
- `home.route.js` links the route `/` to the controller

### 2. Client side (Three.js)

`drones_rendering.js` loads:

- The drone OBJ model
- Its textures
- The waypoint JSON files

It builds a scene with:

- A sky background
- Ground plane
- The drone moving along predefined paths

Everything is rendered in the browser using WebGL.

## Dependencies

Main packages used:
```json
{
  "express": "^4.x",
  "ejs": "^3.x",
  "three": "^0.x"
}
```

## Technologies

- **Backend:** Node.js, Express.js
- **Frontend:** Three.js, WebGL
- **Template Engine:** EJS
- **3D Assets:** OBJ/MTL models with PNG/JPG textures