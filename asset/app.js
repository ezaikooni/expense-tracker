if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
    .then(() => {
        console.log('Service Worker Registered');
    })
    .catch(error => {
        console.error('Service Worker registration failed:', error);
    });
}

 
const CLIENT_ID = '1000167571426-pvvdps5g51kb79ea5t9vuocooqvf8teg.apps.googleusercontent.com'; 
const API_KEY = 'AIzaSyAUvJlgnIvgvbYhn0nUMOynRV-EwGRg86w';   
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

const SPREADSHEET_ID = '1wI2O5bEQ97Bj-1SgdQ1hPHOhkGTXhgoZn_Bn2rT9eEU';

let tokenClient;
let gapiInited = false;
let gisInited = false;
 
document.getElementById('authorize_button').style.visibility = 'hidden';
document.getElementById('signout_button').style.visibility = 'hidden';

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
    });
    authInstance = gapi.auth2.getAuthInstance();
    gapiInited = true;
     
    maybeEnableButtons();
    checkStoredToken();
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
    });
    gisInited = true;
    maybeEnableButtons();
}
 
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.getElementById('authorize_button').style.visibility = 'visible';
    }
}
let idToken = '';

function handleAuthClick() {
    Swal.fire({
        title: 'Authenticating',
        text: 'Please wait...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            Swal.fire('Error', 'Authentication failed. Please try again.', 'error');
            throw (resp);
        }
        
        // Store the token in localStorage
        localStorage.setItem('access_token', gapi.client.getToken().access_token);
        document.getElementById('signout_button').style.visibility = 'visible';
        document.getElementById('authorize_button').innerText = 'Refresh';
        
        try {
            await fetchUserEmailWithPeopleApi();
            await fetchAndDisplayData(); // Fetch data after successful authorization
            Swal.close(); // Close the loading indicator
        } catch (error) {
            Swal.fire('Error', 'Failed to fetch data. Please try again.', 'error');
        }
    };

    if (gapi.client.getToken() === null) {
        // Check if there's a stored token
        const storedToken = localStorage.getItem('access_token');
        if (storedToken) {
            // Use the stored token
            gapi.client.setToken({ access_token: storedToken });
            document.getElementById('signout_button').style.visibility = 'visible';
            document.getElementById('authorize_button').innerText = 'Refresh';
            fetchAndDisplayData().then(() => Swal.close()); // Close loading after fetching data
        } else {
            // Request a new token with user consent
            tokenClient.requestAccessToken({ prompt: 'consent' });
        }
    } else {
        // Skip display of account chooser and consent dialog for an existing session.
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

async function fetchUserEmailWithPeopleApi() {
    try {
        const accessToken = gapi.client.getToken().access_token;
        const response = await fetch('https://people.googleapis.com/v1/people/me?personFields=emailAddresses', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        const data = await response.json();
        const userEmail = data.emailAddresses[0].value;
        localStorage.setItem('userEmail', userEmail);
        console.log('User email:', userEmail); 
    } catch (error) {
        console.error('Error fetching user email:', error);
        Swal.fire('Error', 'Failed to fetch user email. Please try again.', 'error');
    }
}

async function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        localStorage.removeItem('access_token'); // Remove the token from localStorage
        localStorage.removeItem('userEmail');
        document.getElementById('authorize_button').innerText = 'Authorize';
        document.getElementById('signout_button').style.visibility = 'hidden';
        const expenseList = document.getElementById('expense-list');
        expenseList.innerHTML = ''; // Clear the list before adding new items
        const noDataItem = document.createElement('li');
        noDataItem.className = 'list-group-item';
        noDataItem.textContent = 'No expenses found.';
        expenseList.appendChild(noDataItem);
        currentPage = 1; 
        totalPages = 0;
        allRows = []; 
        displayPage(currentPage);
        updatePaginationButtons();
        Swal.fire('Signed Out', 'You have been signed out successfully.', 'success'); 
    }
}

function checkStoredToken() {
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) {
        // Use the stored token
        gapi.client.setToken({ access_token: storedToken });
        document.getElementById('signout_button').style.visibility = 'visible';
        document.getElementById('authorize_button').innerText = 'Refresh';
        fetchAndDisplayData().then(() => Swal.close()); // Close loading after fetching data
    }
} 
 
let currentPage = 1;
const itemsPerPage = 5;
let totalPages = 0;
let allRows = []; 

async function fetchAndDisplayData() {
    try {
        // Show loading indicator
        Swal.fire({
            title: 'Loading',
            text: 'Fetching your expense data...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // Get the user's email from local storage and format it as a sheet name
        const userEmail = localStorage.getItem('userEmail');
        const sheetName = userEmail.replace(/[@.]/g, '_'); // Replace special characters to ensure valid sheet name

        // Construct the range to use the specific sheet name
        const range = `${sheetName}!A2:D`; // Adjust the range as needed

        // Fetch data from the specified sheet
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
        });

        // Process and sort the data
        allRows = response.result.values || [];
        allRows.sort((a, b) => {
            const dateA = new Date(a[0]); // Parse date from the first column
            const dateB = new Date(b[0]);
            return dateB - dateA; // Sort in descending order (latest first)
        });

        // Calculate the total number of pages
        totalPages = Math.ceil(allRows.length / itemsPerPage);
        currentPage = 1; // Reset to the first page whenever data is fetched

        // Update pagination buttons and display the first page
        updatePaginationButtons();
        displayPage(currentPage);

        // Close the loading indicator
        Swal.close();
    } catch (error) {
        console.error('Error fetching data from Google Sheets:', error);

        // Close the loading indicator in case of error
        Swal.close();

        // Handle the case where the specified sheet does not exist
        if (error.status === 404) {
            Swal.fire('Error', 'The specified sheet does not exist. Please ensure the sheet name is correct.', 'error');
        } else {
            Swal.fire('Error', 'Failed to fetch data. Please try again.', 'error');
        }
    }
}
 
function displayPage(page) {
    const expenseList = document.getElementById('expense-list');
    expenseList.innerHTML = ''; // Clear the list before adding new items

    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const rows = allRows.slice(startIndex, endIndex);

    if (rows.length > 0) {
        rows.forEach((row, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item d-flex align-items-center justify-content-between';

            // Extract the file ID from the provided link in row[3]
            const fileIdMatch = row[3].match(/(?:id=|\/d\/|\/file\/d\/)([a-zA-Z0-9-_]+)/);
            const fileId = fileIdMatch ? fileIdMatch[1] : null;

            // Create an anchor element to wrap the image
            const link = document.createElement('a');
            if (fileId) {
                link.href = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
                link.target = '_blank';
            } else {
                link.href = '#';
            }

            // Create an image element for the receipt preview
            const img = document.createElement('img');
            img.src = fileId ? `https://drive.google.com/thumbnail?id=${fileId}` : 'https://via.placeholder.com/150?text=No+Image';
            img.alt = 'Receipt Image';
            img.className = 'img-thumbnail';
            img.style.maxWidth = '100px';
            img.style.marginRight = '10px';

            // Append the image to the link
            link.appendChild(img);
            listItem.appendChild(link);

            // Create content for the item and amount details
            const content = document.createElement('div');
            content.innerHTML = `<h5 class="mb-1">Item: ${row[1]}</h5> 
                                 <p class="mb-1">Amount: ${row[2]}</p>
                                 <small class="text-muted">Date: ${row[0]}</small>`;
            listItem.appendChild(content);

            // Create a container for action buttons
            const actionContainer = document.createElement('div');

            // Add an Edit button
            const editButton = document.createElement('button');
            editButton.className = 'btn btn-sm btn-warning mr-2';
            editButton.textContent = 'Edit';
            editButton.addEventListener('click', () => {
                // Handle edit action here (e.g., show an edit form)
                editExpense(index + startIndex);
            });

            // Add a Delete button
            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn btn-sm btn-danger';
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', () => {
                // Handle delete action here (e.g., remove from Google Sheets)
                deleteExpense(index + startIndex);
            });

            // Append buttons to the action container
            actionContainer.appendChild(editButton);
            actionContainer.appendChild(deleteButton);

            // Append the action container to the list item
            listItem.appendChild(actionContainer);

            // Add the list item to the expense list
            expenseList.appendChild(listItem);
        });
    } else {
        const noDataItem = document.createElement('li');
        noDataItem.className = 'list-group-item';
        noDataItem.textContent = 'No expenses found.';
        expenseList.appendChild(noDataItem);
    }

    document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;
}

async function editExpense(index) {
    // Fetch the expense data from allRows using the index and show an edit form.
    const expense = allRows[index];
    const originalItem = expense[1]; // Item name from the original data
    const originalAmount = expense[2]; // Amount from the original data
    const originalReceiptUrl = expense[3]; // URL of the original receipt

    Swal.fire({
        title: 'Edit Expense',
        html:
            `<label for="edit-item">Item:</label>` +
            `<input id="edit-item" class="swal2-input" value="${originalItem}">` +
            `<label for="edit-amount">Amount:</label>` +
            `<input id="edit-amount" type="number" class="swal2-input" value="${originalAmount}">` +
            `<label for="edit-receipt">Receipt:</label>` +
            `<input id="edit-receipt" type="file" class="swal2-file" accept="image/*">` +
            `<p class="mt-2"><a href="${originalReceiptUrl}" target="_blank">View current receipt</a></p>`,
        focusConfirm: false,
        showCancelButton: true,
        preConfirm: () => {
            const newItem = document.getElementById('edit-item').value;
            const newAmount = document.getElementById('edit-amount').value;
            const newReceiptFile = document.getElementById('edit-receipt').files[0];

            if (!newItem || !newAmount) {
                Swal.showValidationMessage('Item and Amount are required');
                return false;
            }

            return {
                newItem,
                newAmount,
                newReceiptFile
            };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const { newItem, newAmount, newReceiptFile } = result.value;

            try {
                // Show a loading indicator
                Swal.fire({
                    title: 'Updating...',
                    text: 'Please wait while the expense is being updated.',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                // Get the user's email to determine their sheet name
                const userEmail = localStorage.getItem('userEmail');
                const sheetName = userEmail.replace(/[@.]/g, '_'); // Replace special characters to ensure a valid sheet name

                // Construct the range for the specific row in the user's sheet
                const rowNumber = index + 2; // Add 2 because index is zero-based, and sheet data starts from A2
                const range = `${sheetName}!A${rowNumber}:E${rowNumber}`;

                let updatedReceiptUrl = originalReceiptUrl;

                // If a new receipt file is uploaded, upload it to Google Drive and get the new URL
                if (newReceiptFile) {
                    updatedReceiptUrl = await uploadFileToDrive(newReceiptFile);
                }

                // Prepare the updated values
                const updatedValues = [
                    [expense[0], newItem, newAmount, updatedReceiptUrl, expense[4]] // Date, new Item, new Amount, new Receipt URL, User Email
                ];

                // Update the Google Sheets data
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: range,
                    valueInputOption: 'RAW',
                    resource: {
                        values: updatedValues
                    }
                });

                // Refresh the data display after updating
                await fetchAndDisplayData();

                // Show a success message
                Swal.fire('Updated!', 'The expense has been updated successfully.', 'success');
            } catch (error) {
                console.error('Error updating expense:', error);
                Swal.fire('Error', 'Failed to update the expense. Please try again.', 'error');
            }
        }
    });
}

function deleteExpense(index) {
    Swal.fire({
        title: 'Are you sure?',
        text: 'Do you want to delete this expense?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'No, keep it'
    }).then((result) => {
        if (result.isConfirmed) {
            // Remove the expense from Google Sheets here.
            console.log('Expense deleted at index:', index);
        }
    });
}

function updatePaginationButtons() {
    document.getElementById('prev-button').disabled = currentPage === 1;
    document.getElementById('next-button').disabled = currentPage === totalPages || totalPages === 0;
}

document.getElementById('prev-button').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        displayPage(currentPage);
        updatePaginationButtons();
    }
});

document.getElementById('next-button').addEventListener('click', () => {
    if (currentPage < totalPages) {
        currentPage++;
        displayPage(currentPage);
        updatePaginationButtons();
    }
});
 

async function uploadFileToDrive(file) {
    const folderId = '1J1w2xtQnlKWdu7a94F78vY__YY4zVWC7'; // Replace with your folder ID

    const metadata = {
        'name': file.name,
        'mimeType': file.type,
        'parents': [folderId]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const accessToken = gapi.client.getToken().access_token;

    try {
        // Show loading indicator
        Swal.fire({
            title: 'Uploading',
            text: 'Please wait while the receipt is being uploaded...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // Upload the file to Google Drive
        const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
            body: form,
        });

        const data = await uploadResponse.json();
        const fileId = data.id;

        // Set the file to be accessible by anyone with the link
        await setFilePermissions(fileId, accessToken);

        // Close the loading indicator
        Swal.close();

        // Return the shareable link
        // return `https://drive.google.com/uc?id=${fileId}`;
        // return `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
        // return `https://drive.google.com/uc?export=view&id=${fileId}`;
        console.log('Generated fileId:', fileId);
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
    } catch (error) {
        console.error('Error uploading file:', error);

        // Close the loading indicator if there's an error
        Swal.close();

        // Show an error message
        Swal.fire('Error', 'Failed to upload the receipt. Please try again.', 'error');
    }
}
 
// Function to set the file permissions
async function setFilePermissions(fileId, accessToken) {
    const permissions = {
        'role': 'reader', // 'reader' means view-only access
        'type': 'anyone'  // 'anyone' allows anyone with the link to access
    };

    try {
        const permissionResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(permissions)
        });

        if (permissionResponse.ok) {
            console.log('File permissions updated successfully.');
        } else {
            const errorData = await permissionResponse.json();
            console.error('Error setting file permissions:', errorData);
        }
    } catch (error) {
        console.error('Error setting file permissions:', error);
    }
}   

// Add event listener for form submission
document.getElementById('expense-form').addEventListener('submit', async function (event) {
    event.preventDefault();

    const item = document.getElementById('expense-item').value;
    const amount = document.getElementById('expense-amount').value;
    const file = document.getElementById('expense-receipt').files[0];

    if (!file) {
        alert('Please upload a receipt.');
        return;
    }

    try {
        // Upload the image to Google Drive and get the file URL
        const receiptUrl = await uploadFileToDrive(file);

        // Add the expense data to Google Sheets with the receipt URL
        await addExpenseToSheet(item, amount, receiptUrl);
    } catch (error) {
        console.error('Error during upload or saving expense:', error);
        alert('Failed to upload receipt or save expense.');
    }
});

async function addExpenseToSheet(item, amount, receiptUrl) {
    const userEmail = localStorage.getItem('userEmail'); 
    const sheetName = userEmail.replace(/[@.]/g, '_'); // Replace special characters to ensure valid sheet name
    const values = [
        [new Date().toLocaleString(), item, amount, receiptUrl, userEmail]
    ];
    const body = { values: values };

    try {
        // Show loading indicator before any actions
        Swal.fire({
            title: 'Processing',
            text: 'Saving your expense and fetching data...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // Check if the sheet for this user exists, create if not
        await ensureSheetExists(sheetName);

        // Append the data to the user's specific sheet
        const response = await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1:E1`, // Adjust the range to include the new User ID column
            valueInputOption: 'RAW',
            resource: body,
        });

        console.log('Expense added to sheet:', response); 
        document.getElementById('expense-form').reset();

        // Fetch updated data after adding an expense
        await fetchAndDisplayData();
        
        // Close the loading indicator after all operations complete
        Swal.close();
    } catch (error) {
        console.error('Error adding expense:', error);

        // Close the loading indicator in case of error
        Swal.close();

        // Show error message to the user
        Swal.fire('Error', 'Failed to save expense or fetch data. Please try again.', 'error');
    }
} 

// Function to ensure a sheet exists for the user
async function ensureSheetExists(sheetName) {
    try {
        // Get the spreadsheet details
        const spreadsheet = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });

        // Check if the sheet already exists
        const sheetExists = spreadsheet.result.sheets.some(
            (sheet) => sheet.properties.title === sheetName
        );

        if (!sheetExists) {
            // Create a new sheet for the user
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [
                        {
                            addSheet: {
                                properties: {
                                    title: sheetName,
                                },
                            },
                        },
                    ],
                },
            });
            console.log(`Sheet "${sheetName}" created.`);
        }
    } catch (error) {
        console.error('Error ensuring sheet exists:', error);
    }
}
