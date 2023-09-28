import { ContactUs } from './ui-components';
export default function PageSection({ isLoading }) {
  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading && <ContactUs />}
    </div>
  )
}

import { EditProfile } from './ui-components';
export default function PageSection({ isLoading }) {
  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading && <EditProfile />}
    </div>
  )
}  

import { Filters } from './ui-components';
export default function PageSection({ isLoading }) {
  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading && <Filters />}
    </div>
  )
}

import { Logo } from './ui-components';
export default function PageSection({ isLoading }) {
  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading && <Logo />}
    </div>
  )
}

import { NavBarHeader2 } from './ui-components';
export default function PageSection({ isLoading }) {
  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading && <NavBarHeader2 />}
    </div>
  )
}

import { SideBar } from './ui-components';
export default function PageSection({ isLoading }) {
  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading && <SideBar />}
    </div>
  )
}
