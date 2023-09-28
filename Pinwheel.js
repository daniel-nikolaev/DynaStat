import { Pinwheel } from '@uiball/loaders'

<Pinwheel 
 size={100}
 lineWeight={3.5}
 speed={1} 
 color="black" 
/>

export default function PageSection({ isLoading }) {
  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading && <Pinwheel />}
    </div>
  )
}
