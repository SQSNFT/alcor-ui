import { SymbolCode } from 'eos-common'

import { nameToUint64 } from '../../../utils'
import { getAllLockContracts } from '../../../utils/ibc'

export async function getWrapLockContracts(chains) {
  const promises = []
  const tokenPromises = []
  const groupedResults = []
  const allWraplockContracts = []
  const wrapLockContracts = []

  for (const chain of chains) for (const wrapLockContract of getAllLockContracts(chain)) {
    allWraplockContracts.push(wrapLockContract)

    promises.push(
      chain.rpc.get_table_rows({ code: wrapLockContract, scope: wrapLockContract, table: 'global' }),
      chain.rpc.get_table_rows({ code: wrapLockContract, scope: wrapLockContract, table: 'contractmap' })
    )
  }

  const initialResults = (await Promise.all(promises)).map(r => r.rows)
  while (initialResults.length) groupedResults.push(initialResults.splice(0, 2))

  for (const result of groupedResults) {
    const global = result[0][0]
    const contractMaps = result[1]

    for (const map of contractMaps) {
      const chain = chains.find(c => c.chainId === global.chain_id)
      if (!chain) continue
      tokenPromises.push(chain.rpc.get_table_by_scope({ code: map.native_token_contract, table: 'stat' }))
    }
  }

  const tokenResults = await Promise.all(tokenPromises)

  let tokenResultsIndex = 0

  for (const result of groupedResults) {
    const global = result[0][0]
    const contractMaps = result[1]

    for (const map of contractMaps) {
      const chain = chains.find(c => c.chainId === global.chain_id)
      const pairedChain = chains.find(c => c.chainId === global.paired_chain_id)

      if (!chain) continue

      const symbolsres = tokenResults[tokenResultsIndex]

      const symbols = symbolsres.rows.map(r => new SymbolCode(Number(nameToUint64(r.scope))).toString())

      wrapLockContracts.push({
        chain: chain.name,
        pairedChain: pairedChain.name,
        chain_id: global.chain_id,
        wrapLockContract: allWraplockContracts[tokenResultsIndex],
        nativeTokenContract: map.native_token_contract,
        pairedChainId: global.paired_chain_id,
        bridgeContract: global.bridge_contract,
        pairedWrapTokenContract: map.paired_wraptoken_contract,
        symbols
      })

      tokenResultsIndex++
    }
  }

  return wrapLockContracts
}
