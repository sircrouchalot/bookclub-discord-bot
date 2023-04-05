require('dotenv').config({ path: `./.env.${process.env.NODE_ENV}` });

const { Client, 
    Collection,
    Events,
    GatewayIntentBits,
    REST,
    Routes,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder,
} = require('discord.js');

const fs = require('node:fs');
const path = require('node:path');
const { Op } = require("sequelize");
const { request } = require('undici');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client ({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent
    ],
});

const db = require(`./data/config/database.js`);
const Books = require("./data/models/Books.js");
const Guilds = require("./data/models/Guilds.js");
const Botms = require("./data/models/Botms.js");

let botmChannel_Id;
let botmChannel_Name;
let botmChannel_Object = {};

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
};

function dateToString(date) {
    wMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    if (date.split('/').length === 2) {

        if (date.split('/')[0].length === 2) {
            const month = parseInt(date.split('/')[0]) - 1;
            const year = date.split('/')[1];

            return `${wMonths[month]}, ${year}`
        }
    }

    if (date.split('-').length === 2) {

        if (date.split('-')[0].length === 2) {
            const month = parseInt(date.split('-')[0]) - 1;
            const year = date.split('-')[1];

            return `${wMonths[month]}, ${year}`
        }
    } else {
        throw new Error(`Date is in wrong format!`);
    }
};

// Executes commands
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    guildCheck(interaction);
    const command = interaction.client.commands.get(interaction.commandName);

    // If the command is /choosebotm, then the app checks if a channel has been set for botm updates.
    if (interaction.commandName === 'choosebotm' && (botmChannel_Id === undefined)) {
        return await interaction.reply({
            content: "***You haven't set a channel for Book of the Month updates, or it was reset. Please use /setbotmchannel to do so.***",
            components: [],
            ephemeral: true
        })
    }

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

// /SETBOTMCHANNEL - Listener for handling setting botm channel to global variable
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isStringSelectMenu() && (interaction.customId === 'botmChannelSelect')) {
        botmChannel_Id = interaction.values[0];
        botmChannel_Object = interaction.guild.channels.cache.get(botmChannel_Id);
        botmChannel_Name = botmChannel_Object.name;

        await interaction.update({
            content: `Book of the Month channel is set to: ${botmChannel_Name}`,
            components: [],
            ephemeral: true
        });
    } else {
        return;
    }
})

// /CHOOSEBOTM - Choose Month - Handles selecting a month in order to set a Book of the Month
client.on(Events.InteractionCreate, async interaction => {
	if (interaction.isStringSelectMenu() && (interaction.customId === 'monthSelect')) {

        // Grab date that was input by user
        const dateString = interaction.values[0];

        // Counts how many books share that date in the Botms table
        const { count } = await Botms.findAndCountAll({
            where: {
                month_string: dateString
            }
        })

        // If count is greater than 0, then a book has already been chosen for that month
        if (count > 0) {
            console.log(`That month's book has already been chosen. Select a different month.`);
            return interaction.update({
                content: `That month's book has already been chosen. Select a different month.`,
                ephemeral: true
            })
        } 

        // Find all books in Books table for that date
        const books = await Books.findAll({
            where: {
                month_string: dateString,
                guild_id: interaction.guild.id
            }
        })

        // If there are books for that month in the Books table, then create a book object fore each one
        if (books) {
            let stringSelect =[];
            
            for (const book in books) {
                let bookObject = {
                    book_uid: books[book].book_uid,
                    guild_id: books[book].guild_id,
                    month: books[book].month,
                    month_string: books[book].month_string,
                    title: books[book].title,
                    author: books[book].author,
                    pages: books[book].pages,
                    grUrl: books[book].grUrl,
                    submitted_by: books[book].submitted_by,
                    botm_flag: books[book].botm_flag,
                }

                const book_uid = bookObject.book_uid;
                const title = bookObject.title;
                const author = bookObject.author;
                const monthString = bookObject.month_string;
                const guild_id = bookObject.guild_id;

                // Push book options to an array to be passed to StringSelectMenuBuilder
                stringSelect.push({
                    label: `${title} by ${author}`,
                    value: `${book_uid}, ${guild_id}, ${monthString}`
                })
            }

            // Choose Book from list of Books in database matching the month
            const selectBotm = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('botmSelect')
                    .setPlaceholder('Select Book of the Month')
                    .addOptions(stringSelect),
            );
            await interaction.update({
                content: "",
                components: [selectBotm],
                ephemeral: true
            });
        } else {
            return await interaction.update({
                content: "",
                components: [selectBotm],
                ephemeral: true
            });
        }
    } else {
        return;
    }
});

// /CHOOSEBOTM - Choose Book - Handles selecting a book for Book of the Month
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isStringSelectMenu() && (interaction.customId === 'botmSelect')) {

        const values = interaction.values[0].split(',');

        try {
            // counts all books in the Botms table that share the same book_uid in that guild (guild_id)
            const { count } = await Botms.findAndCountAll({
                where: {
                    book_uid: values[0],
                    guild_id: values[1]
                }
            })

            // Checks if book has already been selected for another month
            if (count > 0) {
                console.log(`That book has already been chosen for a different month! Please try again.`);
                return interaction.update({
                    content: `That book has already been chosen for that month! Please try again.`,
                    components: [],
                    ephemeral: true
                });
            }
                
            // Finds book in Books table that shares book_uid (PK)
            const book = await Books.findByPk(values[0]);

            // If a book is found, push the book to Botm
            if (book) {
                const botm = await Botms.create({
                    book_uid: book.book_uid,
                    guild_id: book.guild_id,
                    month: book.date,
                    month_string: book.month_string,
                    title: book.title,
                    author: book.author,
                    pages: book.pages,
                    grUrl: book.grUrl,
                    submitted_by: book.submitted_by,
                    img_url: book.img_url
                })
                
                // Update the user and let them know the selection was successful
                await interaction.update({
                    content: `You selected ${botm.title} by ${botm.author} for ${botm.month_string}`,
                    ephemeral: true,
                    components: []
                })

                // Send message to Botm channel announcing the book that was selected
                await botmChannel_Object.send({ 
                    content: `@here
                    
***A BOOK HAS BEEN CHOSEN!***

For ${botm.month_string}, **${botm.title} by ${botm.author}** has been selected as the Book of the Month
${botm.grUrl}`
                    
                });
            } else {
                console.log(`There was an error finding the book. Try again.`)
            }
            
        } catch (err) {
            console.log(err);
        }
    } else {
        return;
    }
});

// /SUGGEST - Handles the pop-up when suggesting a book
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isModalSubmit()) return;

    if (interaction.customId === 'suggestBookModal') {

        // Get the data entered by the user
        const month = interaction.fields.getTextInputValue('monthInput');
        const monthString = dateToString(month);
        const title = interaction.fields.getTextInputValue('titleInput');
        const author = interaction.fields.getTextInputValue('authorInput');
        let author_split = author;
        const pageCount = interaction.fields.getTextInputValue('pageInput');
        const grURL = interaction.fields.getTextInputValue('grInput');
        let img_url = "";

        if (author.split('.').length > 1) {
            author_split = author.split('.').join("");
            console.log(author_split);
        }

        const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author_split)}&limit=1`;
        
        console.log(url);

        const bookRes = await request(url);
        const { docs } = await bookRes.body.json();

        if (docs === undefined) {
            console.log(docs);
        } else {
            if (docs[0].covers !== undefined) {
                console.log(`covers field found!`);
                img_url = `https://covers.openlibrary.org/b/id/${docs[0].covers[0]}-M.jpg`;
            } else if (docs[0].cover_i !== undefined) {
                console.log(`cover_i field found!`);
                img_url = `https://covers.openlibrary.org/b/id/${docs[0].cover_i}-M.jpg`;
            }
        }
        

        // Check if month date can be converted to string
        if (!monthString) {
            return interaction.reply({
                content: `Date is in wrong format. Please use mm/yyyy format.`,
                ephemeral: true 
            })
        }

        // Check that link is a goodreads link
        if (!grURL.includes("https://")) {
            return interaction.reply({
                content: `URL is not a valid url. Make sure it contains "https://" at the beginning`,
                ephemeral: true
            })
        }

        // Add book to database
        try {
            const date = `${month.split("/").reverse().join("-")}-01`;
            const book = await Books.create({
                guild_id: interaction.guild.id,
                date: date,
                month_string: monthString,
                title: title,
                author: author,
                pages: pageCount,
                grUrl: grURL,
                submitted_by: interaction.user.tag,
                img_url: img_url
            });

            console.log(book);

            return interaction.reply({
                content: `${interaction.user.tag} suggested ${book.title} by ${book.author} for ${book.month_string}`,
            })
        } catch (error) {
            console.log(error);
            return interaction.reply( {
                content: 'Something went wrong. Try again.',
                ephemeral: true
            });
        }
    }
});

// Executes main function and syncs tables once connected to Client
client.once(Events.ClientReady, async () => {
    try {
        main()
        await db.authenticate().then (async () => {
            console.log("Connection to database has been established successfully.");
            // Botms.sync({ force: true });
            await db.sync({ force: true }).then (async () => 
                console.log("Tables synced!"));
    });
    } catch (err) {
        console.log(err);
    }
});

// Client logs in to servers
client.login(TOKEN);