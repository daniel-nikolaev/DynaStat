import { SideBar } from './ui-components';

export default function PageSection({ isLoading }) {
  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading && <SideBar />}
    </div>
  )
}
