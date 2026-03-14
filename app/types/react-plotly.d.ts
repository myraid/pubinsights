declare module 'react-plotly.js' {
  import { Component, CSSProperties } from 'react'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type PlotData = any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type PlotLayout = any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type PlotConfig = any

  interface PlotParams {
    data: PlotData[]
    layout?: PlotLayout
    config?: PlotConfig
    style?: CSSProperties
    className?: string
    useResizeHandler?: boolean
  }

  export default class Plot extends Component<PlotParams> {}
}
