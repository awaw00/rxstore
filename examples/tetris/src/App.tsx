import * as React from 'react';
import { container } from './ioc';
import { CounterStore } from './stores/CounterStore';
import { Counter } from './components/Counter';

const store = container.get(CounterStore);

class App extends React.Component {
  public render() {
    return (
      <div className="App">
        <Counter store={store}/>
      </div>
    );
  }
}

export default App;
