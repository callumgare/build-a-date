// The scattered stars behind every page.
export default function Stars() {
  return (
    <div className="stars" aria-hidden="true">
      {[1, 2, 3, 4, 5, 6, 7].map((star) => (
        // biome-ignore lint/performance/noImgElement: small decorative SVGs, nothing for next/image to optimise
        <img key={star} className={`star star--${star}`} src={`/star-${star}.svg`} alt="" />
      ))}
    </div>
  )
}
