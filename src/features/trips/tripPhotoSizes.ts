// Match the 48rem article minus 3rem padding, and the 72rem media breakout.
// Source-size rem units follow the browser's default font size. Native auto
// sizes also handle authored root-font overrides for lazy images.
export const TRIP_TEXT_PHOTO_SIZES = '(min-width: 48rem) 45rem, calc(100vw - 3rem)';
export const TRIP_WIDE_PHOTO_SIZES = '(min-width: 74rem) 72rem, calc(100vw - 2rem)';
