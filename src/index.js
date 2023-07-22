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
    ButtonBuilder, 
    ButtonStyle,
} = require('discord.js');

const fs = require('node:fs');
const path = require('node:path');
const { Op } = require("sequelize");
const { request } = require('undici');
const probe = require('probe-image-size');

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
const Votes = require("./data/models/Votes.js");
const Channels = require("./data/models/Channels.js");
const ChannelRef = require("./data/models/ChannelRef.js");

var globalVoteResults;

// Create array for commands
const commands = [];

// Creating a collection for commands in client
client.commands = new Collection();

// Grabbing Folders in /commands
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

// main function
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

// Adds Guild to Guild table if it doesn't already exist
async function guildCheck(guildObj) {

    try {
        const guild = await Guilds.upsert({
            guild_id: guildObj.id,
            guild_name: guildObj.name,
            guild_owner: guildObj.ownerId,
            num_members: guildObj.memberCount,
            guild_locale: guildObj.preferredLocale
        });
    } catch (err) {
        console.log(err);
    }
};

// Converts date entered to string in format 'MONTH, YYYY'
function dateToString(date) {
    wMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (date.split('-').length > 1) {
        return null;
    }
    if (date.split('/').length === 2) {

        if (date.split('/')[0].length === 2) {
            const month = parseInt(date.split('/')[0]) - 1;
            const year = date.split('/')[1];

            return `${wMonths[month]}, ${year}`;
        }
    } else {
        return null;
    }
};

// Gets image size of image at imageUrl
async function getImageSize (imageUrl) {
    let result = await probe (imageUrl);
    let imageObject = result;
    return imageObject;
}

// Grabs book cover image and description of first english edition in open library api request
async function getBookDetails(url) {
    let description = "No description found.";
    let image_url = "";
    const bookRes = await request(url);
    const { docs } = await bookRes.body.json();

    
    if (docs === undefined) {

    } else {
        if (docs[0] !== undefined && docs[0].isbn !== undefined) {
            console.log("isbn found!");
            
            isbnLoop:
            for (entry in docs[0].isbn) {
                image_url = `https://covers.openlibrary.org/b/isbn/${docs[0].isbn[entry]}-L.jpg`;
                const width = (await getImageSize(image_url)).width;
                const height = (await getImageSize(image_url)).height;

                if ((width > 20) && (height > 20)) {
                    const briefReqUrl = `http://openlibrary.org/api/volumes/brief/isbn/${docs[0].isbn[entry]}.json`;
                    console.log(briefReqUrl);
                    const briefRes = await request(briefReqUrl);
                    const { records } = await briefRes.body.json();
                    
                    languageLoop:
                    for (entry in records) {
                        let language = records[entry].details.details.languages;
                        if (language !== undefined) {
                            language = language[0].key.split('/')[2];
                            console.log(language);
                        }

                        if (records[entry].details.details.description !== undefined) {
                            description = records[entry].details.details.description
                            if (typeof description === 'object') {
                                description = description.value;
                            }
                        }
                        if (language === 'eng') {
                            break isbnLoop;
                        } else {
                            break languageLoop;
                        }
                    }
                }
            }
            const bookObject = {image: image_url, desc: description}
            return bookObject;
        } else {
            throw new Error('There was an error searching for that book. There might be a typo.');
        }
    }
}

// Calculates voting results
async function getVoteResults(books) {
    // const date = interaction.values[0].split('//')[1];
    // const dateString = interaction.values[0].split('//')[0];
    const date = books[0].date;
    const dateString = books[0].month_string;
    var totalVoteCount = 0;
    let results = [dateString];

    

    const allVotes = await Votes.findAll({
        where: {
            date: date,
            month_string: dateString,
            guild_id: books[0].guild_id
        },
        raw: true
    });

    totalVoteCount = allVotes.length;

    const getKey = (obj,val) => Object.keys(obj).find(key => obj[key] === val);

    const score = (obj) => {
        let first = obj.firstVotes * 3;
        let second = obj.secondVotes * 2;
        let third = obj.thirdVotes;
        let total = first + second + third;

        return total;
    }

    for (const book in books) {
        let book_vote_record = {};
        book_vote_record.book_uid = books[book].book_uid;
        book_vote_record.title = books[book].title;
        book_vote_record.author = books[book].author;
        book_vote_record.month_string = books[book].month_string;
        book_vote_record.firstVotes = 0;
        book_vote_record.secondVotes = 0;
        book_vote_record.thirdVotes = 0;

        for (const entry in allVotes) {
            const vote_record = JSON.parse(allVotes[entry].votes);
    
            switch (getKey(vote_record, books[book].book_uid)) {
                case undefined:
                    break;

                case "first":
                    book_vote_record.firstVotes++;
                    break;

                case "second":
                    book_vote_record.secondVotes++;
                    break;

                case "third":
                    book_vote_record.thirdVotes++;
                    break;

                default:
                    break;
            }
        }

        book_vote_record.score = score(book_vote_record);
        results.push(book_vote_record);
    }
    
    // Sort the results
    results.sort((a, b) => {
        return b.score - a.score;
    })

    results.splice(1, 0, totalVoteCount);
    console.log(results);

    // Return the results
    return results;
}

// Checks if the book already exists in Botm table
async function doesBotmExist(month, guildId) {

    try {

        const num_botms = await Botms.findAndCountAll({
            where: {
                month_string: month,
                guild_id: guildId
            }
        })

        console.log(num_botms.count > 0);

        if (num_botms.count > 0) {
            return true;
        } else {
            return false;
        }
    } catch (err) {
        console.log(err);
    }
}

// Set Guild Channels
async function setGuildChannels(guild) {
    const discordServer = guild;
    const channels = discordServer?.channels ? JSON.parse(
        JSON.stringify(discordServer.channels)
    ).guild.channels : [];
    console.log(channels);

    for (id in channels) {

        const channelObject = discordServer.channels.cache.get(channels[id]);

        const channelName = channelObject.name;

        await Channels.upsert({
            channel_id: channels[id],
            guild_id: discordServer.id,
            channel_name: channelName,
            channel_type: channelObject.type
        })
    }
}

// Get Book of the Month Channel
async function getBotmChannel(guild) {

    const botmChannel = await Channels.findAll({
        where: {
            guild_id: guild.id,
            botm_channel_flag: 1
        },
        raw: true
    })
    console.log(botmChannel);
    return botmChannel;
}

// Executes commands
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

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
        let channelId = interaction.values[0];
        let channelObj = interaction.guild.channels.cache.get(channelId);
        let channelName = channelObj.name;

        await Channels.update({ botm_channel_flag: 1 }, {
            where: {
                channel_id: channelId,
                guild_id: interaction.guild.id
            }
        }).then(() => {
            interaction.update({
                content: `Book of the Month channel is set to: ${channelName}`,
                components: [],
                ephemeral: true
            });
        })

        
    } else {
        return;
    }
})

// ****OBSOLETE /CHOOSEBOTM - Choose Month - Handles selecting a month in order to set a Book of the Month
client.on(Events.InteractionCreate, async interaction => {
	if (interaction.isStringSelectMenu() && (interaction.customId === 'monthSelect')) {

        // Grab date that was input by user
        const dateString = interaction.values[0];

        // Find all books in Books table for that date
        const books = await Books.findAll({
            where: {
                month_string: dateString,
                guild_id: interaction.guild.id
            }
        })

        // If there are books for that month in the Books table, then create a book object fore each one
        if ((books) && books.length > 0) {
            let stringSelect =[];
            
            for (const book in books) {
                let bookObject = {
                    book_uid: books[book].book_uid,
                    guild_id: books[book].guild_id,
                    date: books[book].month,
                    month_string: books[book].month_string,
                    title: books[book].title,
                    author: books[book].author,
                    pages: books[book].pages,
                    grUrl: books[book].grUrl,
                    submitted_by: books[book].submitted_by,
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

// ****OBSOLETE /CHOOSEBOTM - Choose Book - Handles selecting a book for Book of the Month
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
                    content: `That book has already been chosen for a different month! Please try again.`,
                    components: [],
                    ephemeral: true
                });
            }
                
            // Finds book in Books table that shares book_uid (PK)
            const book = await Books.findByPk(values[0]);

            // If a book is found, push the book to Botm
            if ((book) && book.length > 0) {
                const botm = await Botms.create({
                    book_uid: book.book_uid,
                    guild_id: book.guild_id,
                    date: book.date,
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
//                 await botmChannel_Object.send({ 
//                     content: `@here
                    
// ***A BOOK HAS BEEN CHOSEN!***

// For ${botm.month_string}, **${botm.title} by ${botm.author}** has been selected as the Book of the Month
// ${botm.grUrl}`
                    
//                 });

                const botmEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`${book.title} by ${book.author}`)
                    .setURL(book.grUrl)
                    .setDescription(`${imgDescObject.desc}`)
                    .addFields(
                        {name: 'Page Count', value: book.pages}
                    )
                    .setImage(book.img_url)
                    .setFooter({
                        text: `**Powered by ${client.user.username}** - built by Alex Crouch`
                    })
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

// /GETBOTM - Handles selecting a month to grab the Book of the Month's information
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isStringSelectMenu() && (interaction.customId === 'botmMonthSelect')) {
        let month_string = interaction.values[0].split('//')[0];
        let date_ts = interaction.values[0].split('//')[1];
        let book;

        await Books.findOne({ where: { date: date_ts }, raw: true})
            .then((res) => {
                book = res;
            });

        const bookEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`${book.title} by ${book.author}`)
            .setURL(book.grUrl)
            .addFields(
                {name: 'Page Count', value: `${book.pages}`}
            )
            .setImage(book.img_url)
            .setFooter({
                text: `**Powered by ${client.user.username}** - built by Alex Crouch`
            })
        
        await interaction.reply({
            content: `The book for ${month_string} was suggested by ${book.submitted_by}`,
            embeds: [bookEmbed],
            ephemeral: true
        })
    }
})
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

        if (title.split('.').length > 1) {
            title_split = title.split('.').join("");
            console.log(title_split);
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

        await interaction.deferReply( { ephemeral: true });

        const req_url = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author_split)}&limit=1`;
        
         

        // Add book to database
        try {
            imgDescObject = await getBookDetails(req_url, interaction);   

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
                img_url: imgDescObject.image
            });

            console.log(book);

            const suggestionEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`${book.title} by ${book.author}`)
                .setURL(book.grUrl)
                .setAuthor({ name: `${interaction.user.username} suggested a book for ${book.month_string}!`, iconURL: `${interaction.user.displayAvatarURL()}` })
                .setDescription(`${imgDescObject.desc}`)
                .addFields(
                    {name: 'Page Count', value: book.pages}
                )
                .setImage(book.img_url)
                .setFooter({
                    text: `**Powered by ${client.user.username}** - built by Alex Crouch`
                })

            await interaction.editReply({
                content: `You suggested ${book.title} by ${book.author} for ${book.month_string}`
            })

            interaction.channel.send({ embeds: [suggestionEmbed] });
            
        } catch (error) {
            console.log(error);
            return interaction.editReply( {
                content: 'Something went wrong. Try again. If you continue to have issues use **/manualSuggest**',
            });
        }
    }
});

// /VOTE - Handles when a user votes for the Book of the Month
client.on(Events.InteractionCreate, async interaction => {

    let firstChoiceUid;
    let secondChoiceUid;
    let thirdChoiceUid;

    if (interaction.isStringSelectMenu() && (interaction.customId === 'voteMonthSelect')) {

        let vote_record;

        // Grab date that was input by user
        const dateString = interaction.values[0].split('//')[0];
        const date = interaction.values[0].split('//')[1];

        // Find all books in Books table for that date
        const books = await Books.findAll({
            where: {
                date: date,
                month_string: dateString,
                guild_id: interaction.guild.id
            }
        })

        const votes = await Votes.findAll({
            where: {
                date: date,
                month_string: dateString,
                guild_id: interaction.guild.id,
                user: interaction.user.tag
            }
        })

        console.log(`Number of Votes: ${votes.length}`);

        if ((votes) && votes.length === 0) {
            vote_record = await Votes.create({
                guild_id: interaction.guild.id,
                date: date,
                month_string: dateString,
                user: interaction.user.tag,
                votes: JSON.stringify({})
            })
        } else {
            console.log(votes.length)
            vote_record = await Votes.findOne({
                where: {
                    guild_id: interaction.guild.id,
                    date: date,
                    month_string: dateString,
                    user: interaction.user.tag
                }
            })
            console.log(vote_record);
        }

        // If there are books for that month in the Books table, then create a book object fore each one
        if (books && books.length > 0) {
            let stringSelect =[];
            
            for (const book in books) {
                let bookObject = {
                    book_uid: books[book].book_uid,
                    guild_id: books[book].guild_id,
                    date: books[book].date,
                    month_string: books[book].month_string,
                    title: books[book].title,
                    author: books[book].author,
                    pages: books[book].pages,
                    grUrl: books[book].grUrl,
                    submitted_by: books[book].submitted_by,
                }

                const book_uid = bookObject.book_uid;
                const title = bookObject.title;
                const author = bookObject.author;
                const monthString = bookObject.month_string;
                const guild_id = bookObject.guild_id;

                // Push book options to an array to be passed to StringSelectMenuBuilder
                stringSelect.push({
                    label: `${title} by ${author}`,
                    value: `${book_uid}//${vote_record.vote_uid}`
                })
            }

            // Choose Book from list of Books in database matching the month
            const selectFirstChoice = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('voteFirstSelect')
                    .setPlaceholder('Please select your FIRST choice:')
                    .addOptions(stringSelect),
            );
            await interaction.update({
                content: "",
                components: [selectFirstChoice],
                ephemeral: true
            });
        } else {
            return await interaction.update({
                content: `There are no books for this month to vote for. Not sure how you got here. Please try again or try suggesting a book.`,
                components: []
            });
        }
    }

    // Handles when a user selets their FIRST choice - displays options for Second Choice
    if (interaction.isStringSelectMenu() && (interaction.customId === 'voteFirstSelect')) {

        // Grab book that was selected by the user
        firstChoiceUid = interaction.values[0].split('//')[0];
        console.log(firstChoiceUid);

        let vote_uid = interaction.values[0].split('//')[1];
        console.log(vote_uid);

        let vote_record;

        // Get book data of selection by book_uid
        const book = await Books.findByPk(firstChoiceUid);

        // If a book is found, record vote
        if (book) {
            
            vote_record = await Votes.findByPk(vote_uid, {
                attributes: ['votes', 'date', 'month_string'],
                raw: true
            })

            let voteObject = JSON.parse(vote_record.votes)

            voteObject.first = firstChoiceUid;

            await Votes.upsert({
                vote_uid: interaction.values[0].split('//')[1],
                guild_id: interaction.guild.id,
                date: vote_record.date,
                month_string: vote_record.month_string,
                user: interaction.user.tag,
                votes: JSON.stringify(voteObject)
            })
            
            console.log(`${interaction.user.tag} gave 3 votes to ${book.title} by ${book.author} for the month of ${book.month_string}`);

            
        }

        // Find all books in Books table for that month, excluding the book already selected
        const secondChoiceBooks = await Books.findAll({
            where: {
                month_string: vote_record.month_string,
                guild_id: interaction.guild.id,
                book_uid: {
                    [Op.not]: firstChoiceUid
                }
            }
        })

        // If there are books for that month in the Books table, then create a book object fore each one
        if (secondChoiceBooks && secondChoiceBooks.length > 0) {
            let stringSelect =[];
            
            for (const book in secondChoiceBooks) {
                let bookObject = {
                    book_uid: secondChoiceBooks[book].book_uid,
                    guild_id: secondChoiceBooks[book].guild_id,
                    date: secondChoiceBooks[book].date,
                    month_string: secondChoiceBooks[book].month_string,
                    title: secondChoiceBooks[book].title,
                    author: secondChoiceBooks[book].author,
                    pages: secondChoiceBooks[book].pages,
                    grUrl: secondChoiceBooks[book].grUrl,
                    submitted_by: secondChoiceBooks[book].submitted_by,
                }

                const book_uid = bookObject.book_uid;
                const title = bookObject.title;
                const author = bookObject.author;
                const monthString = bookObject.month_string;
                const guild_id = bookObject.guild_id;

                // Push book options to an array to be passed to StringSelectMenuBuilder
                stringSelect.push({
                    label: `${title} by ${author}`,
                    value: `${book_uid}//${vote_uid}`
                })
            }

            // Choose Book from list of Books in database matching the month
            const selectSecondChoice = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('voteSecondSelect')
                    .setPlaceholder('Please select your SECOND choice:')
                    .addOptions(stringSelect),
            );
            await interaction.update({
                content: "",
                components: [selectSecondChoice],
                ephemeral: true
            });
        } else {

            return await interaction.update({
                content: `There are no books left to vote for. Thank you for voting! Please do not vote a second time.`,
                components: []
            });
        }
    }

    // Handles when a user selets their SECOND choice - displays options for Third Choice
    if (interaction.isStringSelectMenu() && (interaction.customId === 'voteSecondSelect')) {

        // Grab book that was selected second by the user
        secondChoiceUid = interaction.values[0].split('//')[0];

        let vote_uid = interaction.values[0].split('//')[1];

        let vote_record;

        // Get book data of selection by book_uid
        const book = await Books.findByPk(secondChoiceUid);

        // If a book is found, record vote
        if (book) {
            vote_record = await Votes.findByPk(vote_uid, {
                attributes: ['votes', 'date', 'month_string'],
                raw: true
            })

            let voteObject = JSON.parse(vote_record.votes)

            voteObject.second = secondChoiceUid;

            firstChoiceUid = voteObject.first;

            await Votes.upsert({
                vote_uid: interaction.values[0].split('//')[1],
                guild_id: interaction.guild.id,
                date: vote_record.date,
                month_string: vote_record.month_string,
                user: interaction.user.tag,
                votes: JSON.stringify(voteObject)
            })
            
            console.log(`${interaction.user.tag} gave 2 votes to ${book.title} by ${book.author} for the month of ${book.month_string}`);
        }

        // Find all books in Books table for that date, excluding the books already selected
        const thirdChoiceBooks = await Books.findAll({
            where: {
                date:vote_record.date,
                month_string: vote_record.month_string,
                guild_id: interaction.guild.id,
                book_uid: {
                    [Op.and]: [
                        {[Op.not]: firstChoiceUid},
                        {[Op.not]: secondChoiceUid}
                    ]
                    
                }
            }
        })

        // If there are books for that month in the Books table, then create a book object fore each one
        if (thirdChoiceBooks && thirdChoiceBooks.length > 0) {
            let stringSelect =[];
            
            for (const book in thirdChoiceBooks) {
                let bookObject = {
                    book_uid: thirdChoiceBooks[book].book_uid,
                    guild_id: thirdChoiceBooks[book].guild_id,
                    date: thirdChoiceBooks[book].date,
                    month_string: thirdChoiceBooks[book].month_string,
                    title: thirdChoiceBooks[book].title,
                    author: thirdChoiceBooks[book].author,
                    pages: thirdChoiceBooks[book].pages,
                    grUrl: thirdChoiceBooks[book].grUrl,
                    submitted_by: thirdChoiceBooks[book].submitted_by,
                }

                const book_uid = bookObject.book_uid;
                const title = bookObject.title;
                const author = bookObject.author;
                const monthString = bookObject.month_string;
                const guild_id = bookObject.guild_id;

                // Push book options to an array to be passed to StringSelectMenuBuilder
                stringSelect.push({
                    label: `${title} by ${author}`,
                    value: `${book_uid}//${vote_uid}`
                })
            }

            // Choose Book from list of Books in database matching the month
            const selectThirdChoice = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('voteThirdSelect')
                    .setPlaceholder('Please select your THIRD choice:')
                    .addOptions(stringSelect),
            );
            await interaction.update({
                content: "",
                components: [selectThirdChoice],
                ephemeral: true
            });
        } else {

            return await interaction.update({
                content: `There are no books left to vote for. Thank you for voting! Please do not vote a second time.`,
                components: [ ]
            });
        }
    }

    // Handles when a user selets their THIRD choice - Records last vote and thanks the user
    if (interaction.isStringSelectMenu() && (interaction.customId === 'voteThirdSelect')) {

        // Grab book that was selected third by the user
        thirdChoiceUid = interaction.values[0].split('//')[0];

        let vote_uid = interaction.values[0].split('//')[1];

        let vote_record;

        // Get book data of selection by book_uid
        const book = await Books.findByPk(thirdChoiceUid);

        let voteObject;
        // If a book is found, record vote
        if (book) {

            vote_record = await Votes.findByPk(vote_uid, {
                attributes: ['votes', 'date', 'month_string'],
                raw: true
            })

            voteObject = JSON.parse(vote_record.votes)

            voteObject.third = thirdChoiceUid;

            await Votes.upsert({
                vote_uid: interaction.values[0].split('//')[1],
                guild_id: interaction.guild.id,
                date: vote_record.date,
                month_string: vote_record.month_string,
                user: interaction.user.tag,
                votes: JSON.stringify(voteObject)
            })
            
            console.log(`${interaction.user.tag} gave 1 vote to ${book.title} by ${book.author} for the month of ${book.month_string}`);

        }

        const picks = await Books.findAll({
            where: {
                [Op.or]: [
                    [{book_uid: voteObject.first}],
                    [{book_uid: voteObject.second}],
                    [{book_uid: voteObject.third}]
                ]
                
            },
            raw: true
        })

        let sortedPicks = {};

        for (const pick in picks) {
            if (picks[pick].book_uid === voteObject.first) {
                sortedPicks['first'] = picks[pick];
                continue;
            }
            if (picks[pick].book_uid === voteObject.second) {
                sortedPicks['second'] = picks[pick];
                continue;
            }
            if (picks[pick].book_uid === voteObject.third) {
                sortedPicks['third'] = picks[pick];
                continue;
            }
        }



        let message = `
        Here are your picks for ${book.month_string}:

        **FIRST**: ${sortedPicks.first.title} by ${sortedPicks.first.author}
        **SECOND**: ${sortedPicks.second.title} by ${sortedPicks.second.author}
        **THIRD**: ${sortedPicks.third.title} by ${sortedPicks.third.author}`


        return await interaction.update({
            content: `Thank you for voting! Your votes have been recorded! If you vote again for ${book.month_string}, you will overwrite your current picks.
${message}`,
            components: []
        })
    }
});

// /VOTERESULTS - Handles when a user wants to see the voting results for a specific month
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isStringSelectMenu() && (interaction.customId === 'resultsMonthSelect')) {
        const date = interaction.values[0].split('//')[1];
        const dateString = interaction.values[0].split('//')[0];
        let resultString = `Here are the voting results for ${dateString}:
         `;

        const books = await Books.findAll({
            where: {
                date: date,
                month_string: dateString,
                guild_id: interaction.guild.id
            },
            raw: true
        });
        await getVoteResults(books).then((results) => {
            globalVoteResults = results;
            for (var i = 2; i < results.length; i++) {

                resultString = `${resultString}
**${results[i].title} by ${results[i].author}**
    First Choice Votes: ${results[i].firstVotes}
    Second Choice Votes: ${results[i].secondVotes}
    Third Choice Votes: ${results[i].thirdVotes}
    Total Score: ${results[i].score}
    `;

            }
            resultString = `${resultString}
${results[1]} total vote(s).`
        });

        const buttonRow = new ActionRowBuilder()
            .addComponents(
                    new ButtonBuilder()
                        .setCustomId('publishResults')
                        .setLabel('Publish Results!')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('cancelPublish')
                        .setLabel('No')
                        .setStyle(ButtonStyle.Danger)
            )

        await interaction.update({
            content: `${resultString}
            
Would you like to publish these results to everyone?`,
            components: [buttonRow],
            fetchReply:true,
        })
    }
});

// Publish Results Button - Handles when an admin wants to publish results to the server
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;
    const botmChannel_Id = (await getBotmChannel(interaction.guild))[0].channel_id;
    console.log(botmChannel_Id);
    const botmChannel_Object = client.channels.cache.get(botmChannel_Id);

    if (interaction.customId === 'cancelPublish') {

        await interaction.update({
            content: `
${interaction.message.content}

***You did not publish these results.***`,
            components: []
        })
        
    }

    if (interaction.customId === 'publishResults') {

        if ((await doesBotmExist(globalVoteResults[0], interaction.guild.id))) {
            return await interaction.update({
                content: `
${interaction.message.content}

***A book has already been picked for this month.*** Please select a different month`,
            components: []
            })
        }
        
        if (botmChannel_Id !== undefined) {


            await interaction.update({
                content: `
${interaction.message.content}

***Publishing...***`,
                components: []
            })

            const books = await Books.findAll({
                where: {
                    month_string: globalVoteResults[0],
                    guild_id: interaction.guild.id
                },
                raw: true
            });

            globalVoteResults = [];

            let bookUidArray = [];

            const results = await getVoteResults(books);


            for (var i = 2; i < results.length; i++) {
                bookUidArray.push(results[i].book_uid)
                console.log(results[i].book_uid)
            }

            console.log(bookUidArray);

            const firstPlace = await Books.findOne({
                where: {
                    book_uid: bookUidArray[0],
                    month_string: results[0],
                    guild_id: interaction.guild.id

                },
                raw: true
            })

            var secondPlace;
            try {

                await Books.findOne({
                    where: {
                        book_uid: bookUidArray[1],
                        month_string: results[0],
                        guild_id: interaction.guild.id

                    },
                    raw: true
                }).then((res) => {
                    secondPlace = res;
                })
            } catch (err) {
                console.log("There was no second choice book...")
            }

            var thirdPlace;
            try {
                await Books.findOne({
                    where: {
                        book_uid: bookUidArray[2],
                        month_string: results[0],
                        guild_id: interaction.guild.id

                    },
                    raw: true
                }).then((res) => {
                    thirdPlace = res;
                })
            } catch (err) {
                console.log("There was no third choice book...")
            }

            await Botms.create({
                book_uid: firstPlace.book_uid,
                guild_id: firstPlace.guild_id,
                date: firstPlace.date,
                month_string: firstPlace.month_string,
                title: firstPlace.title,
                author: firstPlace.author,
                pages: firstPlace.pages,
                grUrl: firstPlace.grUrl,
                submitted_by: firstPlace.submitted_by,
                img_url: firstPlace.img_url
            })

            const publishEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`:first_place: ***${firstPlace.title} by ${firstPlace.author}***`)
                .setAuthor({ name: `${interaction.user.username} just posted the results for ${firstPlace.month_string}!!`, iconURL: `${interaction.user.displayAvatarURL()}`})
                .setURL(firstPlace.grUrl) 
                .addFields(
                    {name: 'Pages', value: `${firstPlace.pages}`, inline: true},
                    {name: `Suggested by`, value: `${firstPlace.submitted_by}`, inline: true},
                    {name: ' ', value: ' ', inline: false},
                    {name: `:second_place: ${secondPlace.title} by ${secondPlace.author}`, value: `-suggested by ${secondPlace.submitted_by}`, inline: false},
                    {name: `:third_place: ${thirdPlace.title} by ${thirdPlace.author}`, value: `-suggested by ${thirdPlace.submitted_by}`, inline: false}
                )
                .setImage(firstPlace.img_url)
                .setFooter({
                    text: `**Powered by ${client.user.username}** - built by Alex Crouch`})

            
                botmChannel_Object.send({
                    content: `@here
**Hey Everyone! THE RESULTS ARE IN for ${firstPlace.month_string}!**
                    `,
                    embeds: [publishEmbed]
                })
        } else {
            await interaction.update({
                content: `
${interaction.message.content}
    
***Error: You need to set a Book of the Month channel.*** Please use **/setbotmchannel** to do so`,
                components: []
            })
        }
    }

})

// Executes main function and syncs tables once connected to Client
client.once(Events.ClientReady, async () => {
    try {
        main()
        await db.authenticate().then (async () => {
            console.log("Connection to database has been established successfully.");
            // Votes.sync({ force: true });
            Botms.sync({ force: true });
            Guilds.sync({ force: false });
            Channels.sync({  });
            await db.sync({  }).then (async () => 
                console.log("Tables synced!"));
    });
    } catch (err) {
        console.log(err);
    }
});

client.on("guildCreate", async function(guild){
    console.log(`the client joined Guild: ${guild.name}`);
    await guildCheck(guild);
    await setGuildChannels(guild);
    await main();

});

// Client logs in to servers
client.login(TOKEN);