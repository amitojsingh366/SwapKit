import { CheckIcon } from '@chakra-ui/icons';
import {
  Avatar,
  Box,
  Button,
  Text,
  Switch,
  FormControl,
  FormLabel,
  VStack,
  Card,
} from '@chakra-ui/react';
import { useState } from 'react';

import { usePioneer } from '../../context/Pioneer';
import Portfolio from '../Portfolio';
// @ts-ignore
export default function MetaMask({ onClose, setIsOpenSide }: any) {
  const { state } = usePioneer();
  const { balances } = state;
  const [isSnapEnabled, setIsSnapEnabled] = useState(true); // Assuming the snap plugin is enabled by default
  const [hasConfirmed, setHasConfirmed] = useState(true);

  // Function to render the success card
  const renderSuccessCard = () => (
    <Box
      alignItems="center"
      backgroundColor="green.700"
      borderRadius="lg"
      display="flex"
      mb={4}
      p={4}
    >
      <CheckIcon color="green.500" h={5} mr={2} w={5} />
      <Text>Pairing Successful</Text>
    </Box>
  );

  const handleOnContinue = () => {
    console.log('Continuing with snap plugin enabled:', isSnapEnabled);
    setHasConfirmed(true);
  };

  return (
    <div>
      <Portfolio />
      {/* Show XL avatar on open */}
      <Avatar
        size="2xl"
        name="User Name"
        /* Replace with actual user name */ mb={4}
      />
      <Button onClick={onClose}>close</Button>
      {!hasConfirmed && (
        <VStack spacing={4}>
          <Card>
            <FormControl
              display="flex"
              alignItems="center"
              p={4}
              borderRadius="lg"
              borderWidth="1px"
            >
              <FormLabel htmlFor="snap-plugin" flex="1">
                Opt into enabling ShapeShifts multichain snap plugin for
                Metamask
              </FormLabel>
              <Switch
                id="snap-plugin"
                isChecked={isSnapEnabled}
                onChange={() => setIsSnapEnabled(!isSnapEnabled)}
              />
            </FormControl>
          </Card>
          <Button colorScheme="blue" onClick={handleOnContinue}>
            Continue
          </Button>
        </VStack>
      )}

      {hasConfirmed && balances.length > 0 && renderSuccessCard()}

      {hasConfirmed && balances.length > 0 && (
        <Box alignItems="flex-end" display="flex" flexDirection="column">
          <Button mb={2} onClick={() => setIsOpenSide(true)}>
            Pair More Wallets
          </Button>
          <Button colorScheme="blue" onClick={onClose}>
            Continue
          </Button>
        </Box>
      )}
    </div>
  );
}
