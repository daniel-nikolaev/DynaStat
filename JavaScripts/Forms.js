import { PatientDataCreateForm } from './ui-components';
export default function PageSection({ isLoading }) {
  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading && <PatientDataCreateForm />}
    </div>
  )
}

import { PatientDataUpdateForm } from './ui-components';
export default function PageSection({ isLoading }) {
  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading && <PatientDataUpdateForm />}
    </div>
  )
}

import { UserInformationCreateForm } from './ui-components';
export default function PageSection({ isLoading }) {
  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading && <UserInformationCreateForm />}
    </div>
  )
}

import { UserInformationUpdateForm } from './ui-components';
export default function PageSection({ isLoading }) {
  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading && <UserInformationUpdateForm />}
    </div>
  )
}
