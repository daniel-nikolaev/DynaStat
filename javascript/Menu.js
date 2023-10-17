import { Menu, MenuItem, IconsProvider, Link } from '@aws-amplify/ui-react';
import { FiMoreHorizontal } from 'react-icons/fi';

export const MenuIcon = () => (
  <IconsProvider
    icons={{
      menu: {
        menu: <FiMoreHorizontal />,
      },
    }}
  >
    <Menu size="small">
      <MenuItem><Link href="google.com">Google</Link></MenuItem>
      <MenuItem>Create a Copy</MenuItem>
      <MenuItem>Mark Draft</MenuItem>
    </Menu>
  </IconsProvider>
);
