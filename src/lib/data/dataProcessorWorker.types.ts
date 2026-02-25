import type { ParseProgress, ProcessedDataModel, TimezoneMode } from '@/lib/types'

export type DataProcessorWorkerRequest =
  | {
      type: 'process-zip'
      file: File
      timezoneMode: TimezoneMode
      historyFileNames?: string[]
    }
  | {
      type: 'process-records'
      records: ProcessedDataModel['records']
      timezoneMode: TimezoneMode
    }

export type DataProcessorWorkerResponse =
  | { type: 'parse:progress'; payload: ParseProgress }
  | { type: 'parse:complete'; payload: ProcessedDataModel }
  | { type: 'parse:error'; payload: { message: string } }
