import { Waveform } from '@uiball/loaders'

export default function PageSection({ isLoading }) {
  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading && <Waveform />}
    </div>
  )
}
