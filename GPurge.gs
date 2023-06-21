function prepare_query(criteria) 
// Negated query and chats not supported.
{

  let query = [];

  if('from' in criteria) {
    query.push('from:' + criteria['from']);
  }
  if('to' in criteria) {
   query.push('to:' + criteria['to']);
  }
  if('subject' in criteria) {
    query.push('subject:' + criteria['subject']);
  }
  if('query' in criteria) {
    query.push(criteria['query']);
  }
  if('hasAttachment' in criteria && criteria['hasAttachment']) {
    query.push('has:attachment');
  }
  if('size' in criteria) {
    if('sizeComparison' in criteria) {
      if(criteria['sizeComparison'] == "smaller") {
        query.push('smaller:' + criteria['size']);
      }
      else if(criteria['sizeComparison'] == "larger") {
        query.push('larger:' + criteria['size']);
      }
    } else {
      query.push('size:' + criteria['size']);
    }
  }

  return query.join(' ');
}

function search_messages(query)
// Executes a filter query, excluding Spam and Trash
// Returns IDs list
{
  let ids = [];
  
  let listParams = {
    maxResults: 500,
    pageToken: '',
    q: query,
    labelIds: [],
    includeSpamTrash: false
  };

  while(true) // pager
  {
    // execute users.messages.list
    let search = Gmail.Users.Messages.list('me', listParams);
    if('messages' in search) {
      ids.push( search['messages'].map( x => x.id ) );
    } else { // the search query returned no messages
      break;
    }

    // next page
    if('nextPageToken' in search) {
      listParams.pageToken = search['nextPageToken'];
    } else {
      break;
    }
  }

  return ids.flat();
}

function get_message_infos(id)
{
  let message = GmailApp.getMessageById(id)
  return message.getSubject() + ' (' + message.getFrom() + ') [' + id + ']';
}

function execute_filter(filter)
// Forwarding is not supported!
{
  if('criteria' in filter && 'action' in filter && 'addLabelIds' in filter['action'] && filter['action']['addLabelIds'].includes('TRASH')) // matches a trashing filter
  {
    let query = prepare_query(filter['criteria']);
    if(query == '')
    {
      console.warn('Invalid filter id ' + filter['id'] + ': No query.');
      return;
    }

    console.info('Executing filter ' + query);
    console.log('id: ' + filter['id'] + ')');

    let to_trash = search_messages(query)

    if(to_trash.length > 0)
    {
      // log infos
      /*let infos = '  - ' + to_trash.map(get_message_infos).join('\n  - ');
      console.info('* Moving ' + to_trash.length + ' messages to Trash:\n' + infos)*/
      console.info('* Moving ' + to_trash.length + ' messages to Trash:')
      to_trash.forEach( id => console.info('  - ' + get_message_infos(id)) )

      // execute users.messages.batchModify
      let batchModifyParams = Gmail.newBatchModifyMessagesRequest();
      batchModifyParams.addLabelIds = filter['action']['addLabelIds'];
      if('removeLabelIds' in filter['action']) {
        batchModifyParams.removeLabelIds = filter['action']['removeLabelIds'];
      }
      for (let i = 0; i < to_trash.length; i += 1000) {
        batchModifyParams.ids = to_trash.slice(i, i + 1000);
        Gmail.Users.Messages.batchModify(batchModifyParams, "me");
      }        
      console.info('  Done.')
    }
    else
    {
      console.info('* No message to delete.')
    }
  }
}

function Run()
{
  console.log('--- GMail Cleaner Filters starting ---');
  let filters = Gmail.Users.Settings.Filters.list('me');
  if(filters) {
    filters = filters['filter'];
    filters.forEach(execute_filter);
    console.log('--- All filters executed ---');
  } else {
    console.log('--- No filters ---');
  }
}
