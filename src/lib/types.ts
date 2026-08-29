export type RatioId = '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3' | '4:5' | '5:4'

export type Ratio = {
  id: RatioId
  label: string
  w: number
  h: number
}

export type PhotoCount = 1 | 2 | 3 | 4 | 6

export type CellRect = { x: number; y: number; w: number; h: number } // 0-1 normalized

export type CellImage = {
  url: string
  name: string
  size: number
  offsetX?: number // -0.5..0.5 pan X (0 = center)
  offsetY?: number // -0.5..0.5 pan Y
  zoom?: number // scale multiplier >= 1 (1 = fit/cover)
}

export type CellData = {
  id: string
  rect: CellRect
  image?: CellImage
}

export type Orientation = 'portrait' | 'landscape'
