require('dotenv').config({ path: `./.env.${process.env.NODE_ENV}` });

const { Client, 
    Collection,
    Events,
    GatewayIntentBits,
    REST,
    Routes
} = require('discord.js');

const fs = require('node:fs');
const path = require('node:path');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client ({
    intents: [
        GatewayIntentBits.Guilds,
    ],
});

const db = require(`./data/config/database.js`);
const Books = require("./data/models/Books.js");
const Guilds = require("./data/models/Guilds.js");

const commands = [];

//Creating a collection for commands in client
client.commands = new Collection();

//Grabbing Folders in /commands
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

const rest = new REST({ version: '10' }).setToken(TOKEN);

for (const folder of commandFolders) {
    //Grabbing Files in /commands/<folder>
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        // Set a new item in the Collection with the key as the command name and the value as the exported module
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
};

async function main() {
    try {
        if (!GUILD_ID) {
            console.log(`Registering ${commands.length} global commands...`)
            const data = await rest.put (
                Routes.applicationCommands(CLIENT_ID), {
                    body: commands
                },
            );
            console.log(`Successfully registered ${data.length}/${commands.length} application commands globally!`);
        } else {
            console.log(`Registering ${commands.length} guild commands...`)
            const data = await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
                    body: commands
                },
            );
            console.log(`Successfully registered ${data.length}/${commands.length} application commands for development guild!`);
            console.log(`Logged in as ${client.user.tag}!`);
        }
    } catch (err) {
        console.log(err);
    }
};

async function guildCheck(interaction) {

    try {
        const guild = await Guilds.upsert({
            guild_id: interaction.guild.id,
            guild_name: interaction.guild.name,
            guild_owner: interaction.guild.ownerId,
            num_members: interaction.guild.memberCount,
            guild_locale: interaction.guild.preferredLocale
        });
    } catch (err) {
        console.log(err);
    }
}

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    guildCheck(interaction);
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.log(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: 'There was an error executing this command!',
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: 'There was an error while executing this command!',
                ephemeral: true
            });
        }
    }
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isModalSubmit()) return;

    if (interaction.customId === 'addBookModal') {
        await interaction.reply({
            content: 'Book has been added! Thanks!',
            ephemeral: true
        })

        // Get the data entered by the user
        const monthInput = interaction.fields.getTextInputValue('monthInput');
        const month = monthInput.split('/')[0];
        const year = monthInput.split('/')[1];
        const date = new Date(year, month-1, 01);
        const title = interaction.fields.getTextInputValue('titleInput');
        const author = interaction.fields.getTextInputValue('authorInput');
        const pageCount = interaction.fields.getTextInputValue('pageInput');
        const grURL = interaction.fields.getTextInputValue('grInput');
        console.log({ date, title, author, pageCount, grURL });
    }

    if (interaction.customId === 'suggestBookModal') {

        // Get the data entered by the user
        const monthInput = interaction.fields.getTextInputValue('monthInput');
        const month = monthInput.split('/')[0];
        const year = monthInput.split('/')[1];
        const date = new Date(year, month-1, 01);
        const title = interaction.fields.getTextInputValue('titleInput');
        const author = interaction.fields.getTextInputValue('authorInput');
        const pageCount = interaction.fields.getTextInputValue('pageInput');
        const grURL = interaction.fields.getTextInputValue('grInput');

        if (month.length === 2 && year.length === 4) {
            console.log({ date, title, author, pageCount, grURL });

        // Add book to database
            try {
                const book = await Books.create({
                    guild_id: interaction.guild.id,
                    month: date,
                    title: title,
                    author: author,
                    pages: pageCount,
                    grUrl: grURL,
                    submitted_by: interaction.user.tag,
                });

                return interaction.reply({
                    content: `${interaction.user.tag} suggested ${title} by ${author} for ${monthInput}`,
                })
            } catch (error) {
                console.log(error);
                return interaction.reply( {
                    content: 'Something went wrong. Try again.',
                    ephemeral: true
                });
            }
        } else {
            return interaction.reply({
                content: 'Date is in wrong format. Please enter it in mm/yyyy format.',
                ephemeral: true
            });
        }
    }
});

client.once(Events.ClientReady, async () => {
    try {
        main()
        await db.authenticate().then (async () => {
            console.log("Connection to database has been established successfully.");
            await db.sync({ force: true}).then (async () => 
                console.log("Tables synced!"))
    });
    } catch (err) {
        console.log(err);
    }
});
client.login(TOKEN);