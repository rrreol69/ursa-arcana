import { Composition } from 'remotion'
import { DEFAULT_PROMO_PROPS, UrsaArcanaXPromo, type UrsaPromoProps } from './UrsaPromo'

export function VideoRoot() {
  return (
    <Composition
      id="UrsaArcanaXPromo"
      component={UrsaArcanaXPromo}
      durationInFrames={2100}
      fps={60}
      width={1920}
      height={1080}
      defaultProps={DEFAULT_PROMO_PROPS satisfies UrsaPromoProps}
    />
  )
}
