import React from 'react';
import { CounterState, CounterStore } from '../stores/CounterStore';

interface Props {
  store: CounterStore;
}

export class Counter extends React.Component<Props, CounterState> {
  private readonly subscription: { unsubscribe: () => any };

  constructor (props: Props) {
    super(props);

    this.subscription = props.store.state$.subscribe(state => {
      if (this.state) {
        this.setState(state);
      } else {
        this.state = state;
      }
    });
  }

  public componentWillUnmount () {
    // 不要忘记移除监听
    this.subscription.unsubscribe();
  }

  public increase = () => {
    const {store} = this.props;
    store.dispatch(store.increase(1));
  };

  public doubleIncrease = () => {
    const {store} = this.props;
    store.dispatch(store.doubleIncrease());
  };

  public asyncDouble = () => {
    const {store} = this.props;
    store.dispatch(store.asyncDouble(2000));
  };

  public render () {
    const {count} = this.state;
    return (
      <div>
        <p>Counter: {count}</p>
        <p>
          <button onClick={this.increase}>INCREASE</button>
          <button onClick={this.doubleIncrease}>DOUBLE</button>
          <button onClick={this.asyncDouble}>DOUBLE ASYNC</button>
        </p>
      </div>
    );
  }
}
