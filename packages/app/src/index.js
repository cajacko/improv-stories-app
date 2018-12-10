import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import state from './state';

const { prevEntries, nextEntries, authors } = state;

let globalId = 0;

export default class App extends React.Component {
  constructor(props) {
    super(props);

    this.setTurnContent = this.setTurnContent.bind(this);
    this.onChangeText = this.onChangeText.bind(this);
    this.setInputRef = this.setInputRef.bind(this);
    this.play = this.play.bind(this);
    this.clearPlay = this.clearPlay.bind(this);
    this.addNextEntryPartialToStoryParagraphs = this.addNextEntryPartialToStoryParagraphs.bind(
      this,
    );
    this.addEntryTextToStoryParagraphs = this.addEntryTextToStoryParagraphs.bind(
      this,
    );
    this.hasNextEntries = this.hasNextEntries.bind(this);

    let storyParagraphs = [];

    prevEntries.forEach(({ author, entryPartials }) => {
      const { text, id } = entryPartials[entryPartials.length - 1];

      storyParagraphs = this.addEntryTextToStoryParagraphs(
        text,
        storyParagraphs,
        id,
      );
    });

    this.prevStoryParagraphs = storyParagraphs;
    this.nextEntries = nextEntries;

    this.state = {
      storyParagraphs,
      hasNextEntries: this.hasNextEntries(),
      playing: false,
      inputText: '',
      inputTextHistory: [],
      takingTurn: false,
    };
  }

  clearPlay() {
    this.setState({ playing: false });
    clearInterval(this.interval);

    this.takeTurn();
  }

  takeTurn() {
    this.prevStoryParagraphs = this.state.storyParagraphs;

    this.setState({ takingTurn: true, turnSecondsLeft: 20 }, () => {
      if (this.input) this.input.focus();
    });

    this.turnInterval = setInterval(() => {
      const turnSecondsLeft = this.state.turnSecondsLeft - 1;

      if (turnSecondsLeft <= 0) {
        clearInterval(this.turnInterval);
        if (this.input) this.input.blur();

        this.setState({ turnSecondsLeft: null, takingTurn: false });
        this.setTurnContent();
      } else {
        this.setState({ turnSecondsLeft });
      }
    }, 1000);
  }

  setTurnContent() {
    globalId += 1;

    const entry = {
      id: `newEntry-${globalId}`,
      author: 'author1',
      savedToServerDate: new Date(),
      entryPartials: this.state.inputTextHistory.map(text => {
        globalId += 1;

        return {
          text,
          id: `newEntryPartial-${globalId}`,
        };
      }),
    };

    // Log here to get dummy data
    // console.log(JSON.stringify(entry));
  }

  play() {
    if (this.nextEntries.length) {
      this.setState({ playing: true });

      this.interval = setInterval(() => {
        if (this.nextEntries.length) {
          this.addNextEntryPartialToStoryParagraphs();
        } else {
          this.clearPlay();
        }
      }, 100);
    }
  }

  addNextEntryPartialToStoryParagraphs() {
    if (!this.state.hasNextEntries) {
      this.clearPlay();
      return;
    }

    const { text, id } = this.nextEntries[0].entryPartials[0];

    const nextStoryParagraphs = this.addEntryTextToStoryParagraphs(
      text,
      this.prevStoryParagraphs,
      id,
    );

    if (this.nextEntries[0].entryPartials.length === 1) {
      this.prevStoryParagraphs = nextStoryParagraphs;
      this.nextEntries = this.nextEntries.slice(1);
    } else {
      this.nextEntries[0].entryPartials = this.nextEntries[0].entryPartials.slice(
        1,
      );
    }

    this.setState({
      storyParagraphs: nextStoryParagraphs,
      hasNextEntries: this.hasNextEntries(),
    });
  }

  addEntryTextToStoryParagraphs(entryText, storyParagraphs, id) {
    let entryParagraphs = entryText.split('\n');

    if (!entryParagraphs.length) return storyParagraphs;

    entryParagraphs = entryParagraphs.map((text, i) => ({
      text,
      id: `${id}-text`,
    }));

    let nextStoryParagraphs = storyParagraphs.slice();

    if (nextStoryParagraphs.length) {
      const lastStoryParagraphIndex = nextStoryParagraphs.length - 1;
      const lastStoryParagraph = nextStoryParagraphs[lastStoryParagraphIndex];
      const firstEntryParagraph = entryParagraphs[0];

      nextStoryParagraphs[lastStoryParagraphIndex] = {
        text: `${lastStoryParagraph.text}${firstEntryParagraph.text}`,
        id: `${lastStoryParagraph.id}-${firstEntryParagraph.id}`,
      };

      entryParagraphs = entryParagraphs.slice(1);
    }

    nextStoryParagraphs = nextStoryParagraphs.concat(entryParagraphs);
    return nextStoryParagraphs;
  }

  hasNextEntries() {
    return (
      !!this.nextEntries.length && !!this.nextEntries[0].entryPartials.length
    );
  }

  setInputRef(inputRef) {
    this.input = inputRef;
  }

  onChangeText(inputText) {
    const inputTextHistory = this.state.inputTextHistory.slice();
    inputTextHistory.push(inputText);

    const storyParagraphs = this.addEntryTextToStoryParagraphs(
      inputText,
      this.prevStoryParagraphs,
      `inputText-${globalId}`,
    );

    this.setState({ inputText, inputTextHistory, storyParagraphs });

    globalId += 1;
  }

  render() {
    const showButton = this.state.hasNextEntries && !this.state.playing;

    return (
      <View style={styles.container}>
        <View>
          {this.state.storyParagraphs.map(({ text, id }) => (
            <Text key={id}>{text}</Text>
          ))}
        </View>

        {typeof this.state.turnSecondsLeft === 'number' && (
          <Text>Time left: {this.state.turnSecondsLeft}</Text>
        )}

        {this.state.takingTurn && (
          <TextInput
            style={styles.input}
            ref={this.setInputRef}
            onChangeText={this.onChangeText}
            value={this.state.inputText}
            multiline
            caretHidden
            returnKeyType="done"
            disableFullscreenUI
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
        )}

        {showButton && (
          <TouchableOpacity onPress={this.play}>
            <View style={styles.button}>
              <Text style={styles.buttonText}>Play</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  input: { opacity: 0 },

  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  button: {
    padding: 10,
    backgroundColor: 'blue',
    marginTop: 20,
  },

  buttonText: {
    color: 'white',
  },
});