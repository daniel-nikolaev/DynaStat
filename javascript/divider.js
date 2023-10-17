import { Flex, Text, Divider } from '@aws-amplify/ui-react';

export default function PageSection({ isLoading }) {
  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading && <Flex />}
    </div>
  )
}




export const HorizontalDividerExample = () => (
  <Flex direction="column">
    <Text>Before</Text>
    <Divider orientation="horizontal" />
    <Text>After</Text>
  </Flex>
);