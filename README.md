# Next.js Image Highlight & Crop Tool

This project is a Next.js application that allows users to:
1. Upload an image.
2. Highlight a specific area using a brush tool.
3. Save two resulting images:
    - **Full Highlighted Image**: The original image with the yellow highlight overlay.
    - **Cropped Clean Image**: A rectangular crop of the original image corresponding to the highlighted area, without the highlight overlay.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) with your browser.

## How to Use

1. Click "Choose File" to upload an image.
2. Use your mouse to draw over the subject you want to highlight.
3. Adjust the brush size if needed.
4. Click "Save Images" to download both the highlighted full image and the cropped clean image.
