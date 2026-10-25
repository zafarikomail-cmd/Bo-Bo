import { Component } from 'react'

// Error boundary: if something inside fails to load, show the fallback instead of a white screen.
export class Safe extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err) {
    console.error('Something failed to load:', err)
    if (this.props.onError) this.props.onError(err)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
