const utils = require('helper');
importPackage(Packages.arc.util);

// for testing locally
// const ip = 'localhost';
const ip = '45.79.202.111';

const discordPrefix = '';
let channelId = '';
let serverCommands;

const sendMessage = (msg) => {
  const postBody = {
    channel: channelId,
    msg: msg,
  };

  const stringPostBody = JSON.stringify(postBody);

  const req = Http.post(`http://` + ip + `:5000/api/chat`, stringPostBody)
    .header('Content-Type', 'application/json')
    .header('Accept', '*/*');
  req.timeout = 10000;
  req.error(() => Log.err("Network error: failed to send discord messages"));
  req.submit();
};

const cleanMessage = (message) => {
  const lastCharCode = message.codePointAt(message.length - 1);
  const secondLastCharCode = message.codePointAt(message.length - 2);

  if (
    lastCharCode >= 0xf80 &&
    lastCharCode <= 0x107f &&
    secondLastCharCode >= 0xf80 &&
    secondLastCharCode <= 0x107f
  ) {
    //If the last two characters are both in the range U+0F80 to U+0x107F, then they were generated by foo's client and should not be displayed
    message = message.slice(0, -2); //Remove them
  }

  //If the message contains any of the characters \, <, @, or >, escape the character and put a zero width space after it to avoid pings
  //also remove newlines
  return message.replace(/([\\<@>])/g, '\\$1\u200B').replace(/[\r\n]/g, '');
};

Colors.put('accent', Color.white);
Colors.put('unlaunched', Color.white);
Colors.put('stat', Color.white);
Colors.put('highlight', Color.white);

Events.on(PlayerJoin, (e) => {
  const player = e.player;
  const formattedName = Strings.stripColors(player.name);
  const msg = '**' + formattedName + ' Joined.' + '**';

  sendMessage(msg);
});

Events.on(PlayerLeave, (e) => {
  const player = e.player;
  const formattedName = Strings.stripColors(player.name);
  const msg = '**' + formattedName + ' Left.' + '**';

  sendMessage(msg);
});

Events.on(PlayerChatEvent, (e) => {
  const player = e.player;
  let text = e.message;

  if (text[0] === '/') return;

  const formattedName = Strings.stripColors(player.name);

  const cleanedMessage = cleanMessage(text);

  const msg = '**' + formattedName + '**' + ': ' + cleanedMessage;

  sendMessage(msg);
});

Events.on(ServerLoadEvent, (e) => {
  serverCommands = Core.app.listeners.find(
    (l) => l instanceof Packages.mindustry.server.ServerControl
  ).handler;

  const runner = (method) => new Packages.arc.util.CommandHandler.CommandRunner({ accept: method });

  const savedChannelId = Core.settings.get('discordChatBot', '');

  if (savedChannelId === '') {
    Log.info(
      '\n\nDiscord Bot: No discord channel was found. Please use "setchannel <channelId> to set it!\n\n'
    );
  }

  if (savedChannelId !== '') {
    channelId = savedChannelId;
  }

  // setChannel
  serverCommands.register(
    'setchannel',
    '<channelId>',
    'set the discord channel id to sync with.',
    runner((args) => {
      channelId = args[0];

      Core.settings.put('discordChatBot', channelId);
      Core.settings.manualSave();
      Log.info('Discord channel id set to: ' + channelId);
      return;
    })
  );
});

Timer.schedule(
  () => {
    if (!channelId) return;

    const postBody = {
      channelId: channelId,
    };

    const stringPostBody = JSON.stringify(postBody);

    const req = Http.post(`http://` + ip + `:5000/api/discord`, stringPostBody)
      .header('Content-Type', 'application/json')
      .header('Accept', '*/*');
    req.timeout = 10000;
    req.error(() => Log.err("Network error: failed to fetch discord messages"));
    req.submit((response) => {
      let responseData = response.getResultAsString();
      let messages = JSON.parse(responseData).messages;
      if (messages.length > 0) Call.sendMessage(messages);
    });
  },
  10,
  3
);
