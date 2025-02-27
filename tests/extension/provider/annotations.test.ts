import { vi, describe, it, expect } from 'vitest'
import { commands, NotebookCellKind } from 'vscode'

import { AnnotationsProvider } from '../../../src/extension/provider/annotations'
import { Kernel } from '../../../src/extension/kernel'
import { OutputType } from '../../../src/constants'
import { replaceOutput } from '../../../src/extension/utils'

vi.mock('vscode')
vi.mock('vscode-telemetry')

vi.mock('../../../src/extension/grpc/client', () => ({
  ParserServiceClient: vi.fn(),
}))

vi.mock('../../../src/extension/utils', () => ({
  getAnnotations: vi.fn().mockReturnValue({
    'type': 'stateful.runme/annotations',
    'output': {
      'annotations':
      {
        'background': false,
        'interactive': true,
        'closeTerminalOnSuccess': true,
        'mimeType': 'text/plain',
        'name': 'npm-install',
        'runme.dev/uuid': '849448b2-3c41-4323-920e-3098e71302ce'
      }
    }
  }),
  validateAnnotations: vi.fn(),
  replaceOutput: vi.fn(),
}))

vi.mock('../../../src/extension/runner', () => ({ }))

describe('Runme Annotations', () => {
  const kernel = new Kernel({} as any)
  it('should register a command when initializing', () => {
    new AnnotationsProvider(kernel)
    expect(commands.registerCommand).toBeCalledTimes(1)
    expect(commands.registerCommand).toBeCalledWith('runme.toggleCellAnnotations', expect.anything(), undefined)
  })


  describe('provideCellStatusBarItems', () => {

    it('should not create a status bar item for non-code elements', async () => {
      const annotationsProvider = new AnnotationsProvider(kernel)
      const cell = {
        metadata: {
          background: 'true'
        },
        executionSummary: {
          success: false
        },
        kind: NotebookCellKind.Markup
      }
      const statusBarItems = await annotationsProvider.provideCellStatusBarItems(cell as any)
      expect(statusBarItems).toBe(undefined)
    })

    it('should create a status bar item for code elements', async () => {
      const annotationsProvider = new AnnotationsProvider(kernel)
      const cell = {
        metadata: {
          background: 'true'
        },
        executionSummary: {
          success: false
        },
        kind: NotebookCellKind.Code
      }

      const expectedItem = {
        label: '$(gear) Configure',
        alignment: 2,
        command: {
          title: 'Configure cell behavior',
          command: 'runme.toggleCellAnnotations',
          arguments: [cell],
        },
        tooltip: 'Click to configure cell behavior'
      }

      const statusBarItem = await annotationsProvider.provideCellStatusBarItems(cell as any)
      expect(statusBarItem).toEqual(expectedItem)
    })
  })

  describe('toggleCellAnnotations', () => {
    it('should clear the ouput when the annotation is already rendered', async () => {
      const annotationsProvider = new AnnotationsProvider(kernel)
      const cell = {
        metadata: {
          background: 'true'
        },
        executionSummary: {
          success: false
        },
        kind: NotebookCellKind.Markup,
        outputs: [{
          items: [
            { id: '', items: [], metadata: {}, mime: OutputType.annotations }
          ]
        }]
      }

      const clearOutput = vi.fn()
      const end = vi.fn()
      kernel.createCellExecution = vi.fn().mockResolvedValue({
        start: vi.fn(),
        end,
        clearOutput,
      })
      await annotationsProvider.toggleCellAnnotations(cell as any)
      expect(kernel.createCellExecution).toBeCalledTimes(1)
      expect(clearOutput).toBeCalledTimes(1)
      expect(end).toBeCalledTimes(1)
    })

    it('should replace the output when the annotation is not rendered', async () => {
      const annotationsProvider = new AnnotationsProvider(kernel)
      const cell = {
        metadata: {
          background: 'true'
        },
        executionSummary: {
          success: false
        },
        kind: NotebookCellKind.Markup,
        outputs: []
      }

      const end = vi.fn()
      kernel.createCellExecution = vi.fn().mockResolvedValue({
        start: vi.fn(),
        end,
      })
      await annotationsProvider.toggleCellAnnotations(cell as any)
      expect(kernel.createCellExecution).toBeCalledTimes(1)
      expect(replaceOutput).toBeCalledTimes(1)
      expect(end).toBeCalledTimes(1)
    })
  })
})
