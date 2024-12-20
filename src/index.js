import { Client, GatewayIntentBits, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// 保留中のメッセージを保存
const pendingMessages = new Map();

// Slash Command 登録
const commands = [
  {
    name: 'send',
    description: 'メッセージ送信リクエストを行います。',
    options: [
      {
        name: 'content',
        type: 3, // 文字列
        description: '送信したいメッセージ内容',
        required: true,
      },
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('Slash Command を登録中...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log('Slash Command の登録が完了しました。');
  } catch (error) {
    console.error(error);
  }
})();

// ボットの起動
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// /send コマンドの処理
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'send') {
    const content = interaction.options.getString('content');
    const adminChannel = interaction.guild.channels.cache.find((ch) => ch.name === 'admin-approval');

    if (!adminChannel) {
      return interaction.reply({
        content: '承認用チャンネルが見つかりませんでした。',
        ephemeral: true,
      });
    }

    // 承認ボタンを作成
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_${interaction.id}`)
        .setLabel('承認')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`reject_${interaction.id}`)
        .setLabel('却下')
        .setStyle(ButtonStyle.Danger)
    );

    // 管理者に通知
    const approvalMessage = await adminChannel.send({
      content: `新しい送信リクエスト:\n**送信者**: ${interaction.user}\n**内容**: ${content}`,
      components: [row],
    });

    // メッセージを保留
    pendingMessages.set(interaction.id, {
      content,
      author: interaction.user,
      approvalMessage,
    });

    // ユーザーに通知
    await interaction.reply({
      content: 'メッセージ送信リクエストが送信されました。',
      ephemeral: true,
    });
  }
});

// ボタンの処理
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const { customId } = interaction;

  if (customId.startsWith('approve_')) {
    const requestId = customId.split('_')[1];
    const pending = pendingMessages.get(requestId);

    if (!pending) {
      return interaction.reply({ content: 'このリクエストは既に処理されています。', ephemeral: true });
    }

    const targetChannel = interaction.guild.channels.cache.find((ch) => ch.name === 'general');

    if (!targetChannel) {
      return interaction.reply({ content: '送信先チャンネルが見つかりませんでした。', ephemeral: true });
    }

    // メッセージを送信
    await targetChannel.send(`**${pending.author.username}** さんのメッセージ:\n${pending.content}`);
    await interaction.reply({ content: 'メッセージを承認し、送信しました。', ephemeral: true });

    // 保留中のメッセージを削除
    pendingMessages.delete(requestId);
    await pending.approvalMessage.delete();
  } else if (customId.startsWith('reject_')) {
    const requestId = customId.split('_')[1];
    const pending = pendingMessages.get(requestId);

    if (!pending) {
      return interaction.reply({ content: 'このリクエストは既に処理されています。', ephemeral: true });
    }

    // 却下メッセージを送信
    await interaction.reply({ content: 'メッセージを却下しました。', ephemeral: true });

    // 保留中のメッセージを削除
    pendingMessages.delete(requestId);
    await pending.approvalMessage.delete();
  }
});

client.login(TOKEN);
