import { Pinwheel } from '@uiball/loaders'

<Pinwheel 
 size={35}
 lineWeight={3.5}
 speed={0.75} 
 color="black" 
/>

export default function PageSection({ isLoading }) {
  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading && <Pinwheel />}
    </div>
  )
}
