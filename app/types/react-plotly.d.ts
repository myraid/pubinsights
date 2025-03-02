declare module 'react-plotly.js' {
  import { Component } from 'react'
  
  interface PlotParams {
    data: Array<{
      x: any[]
      y: any[]
      type?: string
      mode?: string
      name?: string
      line?: {
        shape?: string
        smoothing?: number
      }
    }>
    layout?: {
      height?: number
      margin?: { t: number; r: number; b: number; l: number }
      xaxis?: {
        title?: string
        gridcolor?: string
      }
      yaxis?: {
        title?: string
        gridcolor?: string
      }
      hovermode?: string
      plot_bgcolor?: string
      paper_bgcolor?: string
      showlegend?: boolean
      legend?: {
        orientation?: string
        yanchor?: string
        y?: number
        xanchor?: string
        x?: number
      }
    }
    config?: {
      displayModeBar?: boolean
    }
  }

  export default class Plot extends Component<PlotParams> {}
} 