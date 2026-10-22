// SI units. Most dimensions preserve the previous 6 m layout at 0.8 / 6 scale.
export const SCALE = 0.8 / 6
export const scaled = (value) => value * SCALE
export const TABLE_RADIUS = 1.2
export const TABLE_THICKNESS = 0.02
export const TABLE_TOP_HEIGHT = 0.9
export const JOINT_RADIUS = 0.035
export const PLATE_HEIGHT = TABLE_TOP_HEIGHT - TABLE_THICKNESS / 2
// Ball top is tangent to the plate underside, also while the plate rotates.
export const PLATE_OFFSET = JOINT_RADIUS + TABLE_THICKNESS / 2
export const PIVOT_HEIGHT = PLATE_HEIGHT - PLATE_OFFSET
export const LEG_BOTTOM = scaled(0.22)
export const LEG_TOP = PIVOT_HEIGHT - scaled(0.15)
export const LEG_HEIGHT = LEG_TOP - LEG_BOTTOM
export const LEG_CENTER = (LEG_TOP + LEG_BOTTOM) / 2
