# Cruise Chat

CruiseChat aims to be a simple messaging app that works with peer-to-peer connections and therefore doesn't require internet. It requires the users to be close by and therefore is intended to be used on ships.

## Features

- Enhanced logging
- Basic chatrooms with room keys
- Notifications
- Gifs

## Todo

- Add recents to stickers
- Throttling users (limit messages sent per second)

## Developing the native module

[Instructions](https://docs.expo.dev/modules/get-started/#edit-the-module)

## Problems

- The number of synced messages is limited to ~30k bytes
- created_at time can be manipulated by changing phone system time
- Spamming send button sends a lot of messages incorrectly
- Chat doesn't always scroll to the bottom correctly